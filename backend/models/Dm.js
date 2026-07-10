import db from "../config/database.js";

const MAX_BODY_LEN = 1000;

function pairIds(a, b) {
  const x = Number(a);
  const y = Number(b);
  return x < y ? { user_low_id: x, user_high_id: y } : { user_low_id: y, user_high_id: x };
}

const Dm = {
  MAX_BODY_LEN,

  async findConversationById(id) {
    return db("dm_conversations").where({ id }).first();
  },

  async findConversationBetween(userA, userB) {
    const pair = pairIds(userA, userB);
    return db("dm_conversations").where(pair).first();
  },

  async getOrCreateConversation(userA, userB) {
    const a = Number(userA);
    const b = Number(userB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) {
      throw new Error("Invalid conversation participants");
    }
    const pair = pairIds(a, b);
    const existing = await db("dm_conversations").where(pair).first();
    if (existing) return existing;
    try {
      const [id] = await db("dm_conversations").insert(pair);
      return this.findConversationById(id);
    } catch (err) {
      // race: unique constraint
      const again = await db("dm_conversations").where(pair).first();
      if (again) return again;
      throw err;
    }
  },

  isParticipant(conversation, userId) {
    const uid = Number(userId);
    return conversation && (conversation.user_low_id === uid || conversation.user_high_id === uid);
  },

  otherUserId(conversation, meId) {
    const uid = Number(meId);
    if (!conversation) return null;
    return conversation.user_low_id === uid ? conversation.user_high_id : conversation.user_low_id;
  },

  async listConversationsForUser(userId, { limit = 50 } = {}) {
    const uid = Number(userId);
    const rows = await db("dm_conversations as c")
      .where("c.user_low_id", uid)
      .orWhere("c.user_high_id", uid)
      .orderByRaw("COALESCE(c.last_message_at, c.created_at) DESC")
      .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
      .select("c.*");

    const out = [];
    for (const c of rows) {
      const otherId = this.otherUserId(c, uid);
      const other = otherId
        ? await db("users").where({ id: otherId }).select("id", "username", "address").first()
        : null;
      const last = await db("dm_messages")
        .where({ conversation_id: c.id })
        .orderBy("id", "desc")
        .first();
      out.push({
        id: c.id,
        otherUser: other
          ? { userId: other.id, username: other.username || null, address: other.address || null }
          : { userId: otherId, username: null, address: null },
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              senderId: last.sender_id,
              createdAt: last.created_at,
            }
          : null,
        lastMessageAt: c.last_message_at,
        createdAt: c.created_at,
      });
    }
    return out;
  },

  async listMessages(conversationId, { limit = 100, beforeId } = {}) {
    let q = db("dm_messages as m")
      .leftJoin("users as u", "m.sender_id", "u.id")
      .where({ "m.conversation_id": conversationId })
      .orderBy("m.id", "desc")
      .limit(Math.min(200, Math.max(1, Number(limit) || 100)))
      .select(
        "m.id",
        "m.body",
        "m.sender_id",
        "m.created_at",
        "u.username"
      );
    if (beforeId != null && Number(beforeId) > 0) {
      q = q.andWhere("m.id", "<", Number(beforeId));
    }
    const rows = await q;
    return rows
      .map((r) => ({
        id: r.id,
        body: r.body,
        senderId: r.sender_id,
        username: r.username ?? null,
        createdAt: r.created_at,
      }))
      .reverse();
  },

  async sendMessage(conversationId, senderId, bodyRaw) {
    const body = String(bodyRaw ?? "").trim();
    if (!body) throw new Error("Message cannot be empty");
    if (body.length > MAX_BODY_LEN) throw new Error(`Message too long (max ${MAX_BODY_LEN})`);

    const [id] = await db("dm_messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
    });
    await db("dm_conversations").where({ id: conversationId }).update({
      last_message_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

    const row = await db("dm_messages as m")
      .leftJoin("users as u", "m.sender_id", "u.id")
      .where({ "m.id": id })
      .select("m.id", "m.body", "m.sender_id", "m.created_at", "m.conversation_id", "u.username")
      .first();

    return {
      id: row.id,
      conversationId: row.conversation_id,
      body: row.body,
      senderId: row.sender_id,
      username: row.username ?? null,
      createdAt: row.created_at,
    };
  },
};

export default Dm;
