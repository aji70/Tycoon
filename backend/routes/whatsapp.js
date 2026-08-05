import { Router } from "express";
import logger from "../config/logger.js";
import { getWaRampConfig, isWaRampEnabled } from "../services/waRampConfig.js";
import { extractInboundMessages, sendWhatsAppText } from "../services/waRampWhatsapp.js";
import { handleWaRampIncoming } from "../services/waRampCommands.js";

const router = Router();

/** Meta webhook verification */
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const { whatsapp } = getWaRampConfig();

  if (mode === "subscribe" && token === whatsapp.verifyToken) {
    logger.info("[wa-ramp] webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/** Inbound WhatsApp messages */
router.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  if (!isWaRampEnabled()) return;

  try {
    const messages = extractInboundMessages(req.body);
    for (const msg of messages) {
      logger.info(
        { from: msg.from, text: msg.text, phoneNumberId: msg.phoneNumberId },
        "[wa-ramp] inbound"
      );
      const sendOpts = msg.phoneNumberId ? { phoneNumberId: msg.phoneNumberId } : {};
      try {
        const reply = await handleWaRampIncoming({
          from: msg.from,
          text: msg.text,
          phoneNumberId: msg.phoneNumberId,
        });
        if (reply) await sendWhatsAppText(msg.from, reply, sendOpts);
      } catch (inner) {
        logger.error({ err: inner.message, from: msg.from, text: msg.text }, "[wa-ramp] message handle failed");
        try {
          await sendWhatsAppText(
            msg.from,
            "Sorry — ramp hit an error. If this keeps happening, the operator needs to run DB migrate.",
            sendOpts
          );
        } catch (_) {
          /* ignore */
        }
      }
    }
  } catch (e) {
    logger.error({ err: e.message }, "[wa-ramp] webhook handler error");
  }
});

export default router;
