import logger from "../config/logger.js";
import { getWaRampConfig, resolveWhatsAppPhoneNumberId } from "./waRampConfig.js";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * @param {string} to
 * @param {string} body
 * @param {{ phoneNumberId?: string }} [opts] - inbound phone_number_id when replying
 */
export async function sendWhatsAppText(to, body, opts = {}) {
  const { whatsapp } = getWaRampConfig();
  const phoneNumberId = resolveWhatsAppPhoneNumberId(opts.phoneNumberId);

  if (!whatsapp.token || !phoneNumberId) {
    logger.info({ to, body, phoneNumberId }, "[wa-ramp] dry-run send");
    return { dryRun: true };
  }

  const url = `${GRAPH}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${whatsapp.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ status: res.status, data, phoneNumberId }, "[wa-ramp] WhatsApp send failed");
    throw new Error(data?.error?.message || `WhatsApp send failed (${res.status})`);
  }
  return data;
}

export function extractInboundMessages(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;
      const phoneNumberId = value.metadata?.phone_number_id || null;
      for (const msg of value.messages) {
        if (msg.type !== "text") continue;
        out.push({
          from: msg.from,
          id: msg.id,
          text: (msg.text?.body || "").trim(),
          timestamp: msg.timestamp,
          contactName: value.contacts?.[0]?.profile?.name || null,
          phoneNumberId,
        });
      }
    }
  }
  return out;
}
