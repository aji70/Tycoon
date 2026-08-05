import logger from "../config/logger.js";
import { getWaRampConfig } from "./waRampConfig.js";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function sendWhatsAppText(to, body) {
  const { whatsapp } = getWaRampConfig();
  if (!whatsapp.token || !whatsapp.phoneNumberId) {
    logger.info({ to, body }, "[wa-ramp] dry-run send");
    return { dryRun: true };
  }

  const url = `${GRAPH}/${whatsapp.phoneNumberId}/messages`;
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
    logger.error({ status: res.status, data }, "[wa-ramp] WhatsApp send failed");
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
      for (const msg of value.messages) {
        if (msg.type !== "text") continue;
        out.push({
          from: msg.from,
          id: msg.id,
          text: (msg.text?.body || "").trim(),
          timestamp: msg.timestamp,
          contactName: value.contacts?.[0]?.profile?.name || null,
        });
      }
    }
  }
  return out;
}
