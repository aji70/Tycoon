import Dm from "../models/Dm.js";
import User from "../models/User.js";
import logger from "../config/logger.js";
import { canAccessDirectMessages } from "../lib/dmAccess.js";

function userRoom(userId) {
  return `user:${Number(userId)}`;
}

function emitDmMessage(io, recipientId, senderId, payload) {
  if (!io) return;
  try {
    if (recipientId != null) io.to(userRoom(recipientId)).emit("dm-message", payload);
    if (senderId != null && Number(senderId) !== Number(recipientId)) {
      io.to(userRoom(senderId)).emit("dm-message", payload);
    }
  } catch (err) {
    logger.warn({ err }, "emitDmMessage failed");
  }
}

function forbidUnlessDmPreview(req, res) {
  const username = req.user?.username;
  if (!canAccessDirectMessages(username)) {
    res.status(403).json({
      success: false,
      message: "Direct messages are in private preview.",
    });
    return false;
  }
  return true;
}

async function resolveOtherUser(param, body = {}) {
  const asNum = Number(param);
  if (Number.isInteger(asNum) && asNum > 0) {
    return User.findById(asNum);
  }
  const uname = String(param || body.username || "").trim();
  if (uname && !/^0x/i.test(uname)) {
    const byName = await User.findByUsernameIgnoreCase(uname);
    if (byName) return byName;
  }
  const address = String(body.address || (param && /^0x/i.test(String(param)) ? param : "") || "").trim();
  if (address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    return User.resolveUserByAddress(address, body.chain || "CELO");
  }
  return null;
}

const dmController = {
  /** GET /api/dms — list my conversations */
  async list(req, res) {
    try {
      if (!forbidUnlessDmPreview(req, res)) return;
      const me = Number(req.userId);
      const conversations = await Dm.listConversationsForUser(me, {
        limit: Number(req.query.limit) || 50,
      });
      res.json({ success: true, message: "successful", data: conversations });
    } catch (error) {
      logger.error({ err: error }, "dm list error");
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /** POST /api/dms/open — { userId?, username?, address? } */
  async open(req, res) {
    try {
      if (!forbidUnlessDmPreview(req, res)) return;
      const me = Number(req.userId);
      const { userId, username, address, chain } = req.body || {};
      const other =
        (userId != null ? await User.findById(Number(userId)) : null) ||
        (await resolveOtherUser(username || userId, { username, address, chain }));
      if (!other?.id) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      if (Number(other.id) === me) {
        return res.status(400).json({ success: false, message: "Cannot DM yourself" });
      }

      const conversation = await Dm.getOrCreateConversation(me, other.id);
      res.json({
        success: true,
        message: "successful",
        data: {
          id: conversation.id,
          otherUser: {
            userId: other.id,
            username: other.username || null,
            address: other.address || null,
          },
        },
      });
    } catch (error) {
      logger.error({ err: error }, "dm open error");
      res.status(400).json({ success: false, message: error.message });
    }
  },

  /** POST /api/dms/with/:userId — get or create DM with user (id, username, or address) */
  async openWith(req, res) {
    try {
      if (!forbidUnlessDmPreview(req, res)) return;
      const me = Number(req.userId);
      const other = await resolveOtherUser(req.params.userId, req.body || {});
      if (!other?.id) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      if (Number(other.id) === me) {
        return res.status(400).json({ success: false, message: "Cannot DM yourself" });
      }

      const conversation = await Dm.getOrCreateConversation(me, other.id);
      res.json({
        success: true,
        message: "successful",
        data: {
          id: conversation.id,
          otherUser: {
            userId: other.id,
            username: other.username || null,
            address: other.address || null,
          },
        },
      });
    } catch (error) {
      logger.error({ err: error }, "dm openWith error");
      res.status(400).json({ success: false, message: error.message });
    }
  },

  /** GET /api/dms/:id/messages */
  async listMessages(req, res) {
    try {
      if (!forbidUnlessDmPreview(req, res)) return;
      const me = Number(req.userId);
      const conversationId = Number(req.params.id);
      const conversation = await Dm.findConversationById(conversationId);
      if (!conversation || !Dm.isParticipant(conversation, me)) {
        return res.status(404).json({ success: false, message: "Conversation not found" });
      }
      const messages = await Dm.listMessages(conversationId, {
        limit: Number(req.query.limit) || 100,
        beforeId: req.query.beforeId,
      });
      const otherId = Dm.otherUserId(conversation, me);
      const other = otherId ? await User.findById(otherId) : null;
      res.json({
        success: true,
        message: "successful",
        data: {
          conversationId,
          otherUser: other
            ? { userId: other.id, username: other.username || null, address: other.address || null }
            : null,
          messages,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "dm listMessages error");
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /** POST /api/dms/:id/messages — { body } */
  async send(req, res) {
    try {
      if (!forbidUnlessDmPreview(req, res)) return;
      const me = Number(req.userId);
      const conversationId = Number(req.params.id);
      const conversation = await Dm.findConversationById(conversationId);
      if (!conversation || !Dm.isParticipant(conversation, me)) {
        return res.status(404).json({ success: false, message: "Conversation not found" });
      }

      const message = await Dm.sendMessage(conversationId, me, req.body?.body);
      const otherId = Dm.otherUserId(conversation, me);
      emitDmMessage(req.app.get("io"), otherId, me, {
        conversationId,
        message,
      });

      res.status(201).json({ success: true, message: "successful", data: message });
    } catch (error) {
      logger.error({ err: error }, "dm send error");
      res.status(400).json({ success: false, message: error.message });
    }
  },
};

export default dmController;
