import logger from "../config/logger.js";
import { getWaRampConfig, resolveWhatsAppPhoneNumberId } from "./waRampConfig.js";

const GRAPH = "https://graph.facebook.com/v21.0";

async function postMessage(phoneNumberId, payload) {
  const { whatsapp } = getWaRampConfig();
  if (!whatsapp.token || !phoneNumberId) {
    logger.info({ phoneNumberId, payload }, "[wa-ramp] dry-run send");
    return { dryRun: true };
  }

  const url = `${GRAPH}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${whatsapp.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ status: res.status, data, phoneNumberId }, "[wa-ramp] WhatsApp send failed");
    throw new Error(data?.error?.message || `WhatsApp send failed (${res.status})`);
  }
  return data;
}

/**
 * @param {string} to
 * @param {string} body
 * @param {{ phoneNumberId?: string }} [opts]
 */
export async function sendWhatsAppText(to, body, opts = {}) {
  const phoneNumberId = resolveWhatsAppPhoneNumberId(opts.phoneNumberId);
  return postMessage(phoneNumberId, {
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

/**
 * Up to 3 reply buttons. title max 20 chars, id max 256.
 * @param {string} to
 * @param {{ body: string, footer?: string, buttons: { id: string, title: string }[] }} interactive
 * @param {{ phoneNumberId?: string }} [opts]
 */
export async function sendWhatsAppButtons(to, interactive, opts = {}) {
  const phoneNumberId = resolveWhatsAppPhoneNumberId(opts.phoneNumberId);
  const buttons = (interactive.buttons || []).slice(0, 3).map((b) => ({
    type: "reply",
    reply: {
      id: String(b.id).slice(0, 256),
      title: String(b.title).slice(0, 20),
    },
  }));

  const payload = {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: interactive.body },
      action: { buttons },
    },
  };
  if (interactive.footer) {
    payload.interactive.footer = { text: interactive.footer.slice(0, 60) };
  }
  if (interactive.header) {
    payload.interactive.header = { type: "text", text: interactive.header.slice(0, 60) };
  }
  return postMessage(phoneNumberId, payload);
}

/** Dispatch text or button replies from the command layer. */
export async function dispatchWaRampReplies(to, replies, opts = {}) {
  const list = Array.isArray(replies) ? replies : replies ? [replies] : [];
  for (const reply of list) {
    if (!reply) continue;
    if (typeof reply === "string") {
      await sendWhatsAppText(to, reply, opts);
      continue;
    }
    if (reply.type === "text") {
      await sendWhatsAppText(to, reply.text, opts);
      continue;
    }
    if (reply.type === "buttons") {
      await sendWhatsAppButtons(to, reply, opts);
      continue;
    }
  }
}

export function extractInboundMessages(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;
      const phoneNumberId = value.metadata?.phone_number_id || null;
      const contactName = value.contacts?.[0]?.profile?.name || null;

      for (const msg of value.messages) {
        const base = {
          from: msg.from,
          id: msg.id,
          timestamp: msg.timestamp,
          contactName,
          phoneNumberId,
          text: "",
          buttonId: null,
        };

        if (msg.type === "text") {
          out.push({ ...base, text: (msg.text?.body || "").trim() });
          continue;
        }

        if (msg.type === "interactive") {
          const ir = msg.interactive;
          if (ir?.type === "button_reply") {
            out.push({
              ...base,
              buttonId: ir.button_reply?.id || null,
              text: (ir.button_reply?.title || "").trim(),
            });
            continue;
          }
          if (ir?.type === "list_reply") {
            out.push({
              ...base,
              buttonId: ir.list_reply?.id || null,
              text: (ir.list_reply?.title || "").trim(),
            });
            continue;
          }
        }
      }
    }
  }
  return out;
}
