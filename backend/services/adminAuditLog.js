import db from "../config/database.js";
import logger from "../config/logger.js";

const MAX_JSON_BYTES = 30000;

function extractRequestMeta(req) {
  if (!req || typeof req !== "object") {
    return { ip: null, user_agent: null };
  }
  const ff = req.headers?.["x-forwarded-for"];
  const fromForwarded = typeof ff === "string" ? ff.split(",")[0]?.trim() : "";
  const ip = fromForwarded || req.ip || req.socket?.remoteAddress || null;
  const ua = req.headers?.["user-agent"];
  return {
    ip: ip ? String(ip).slice(0, 45) : null,
    user_agent: ua ? String(ua).slice(0, 512) : null,
  };
}

function shallowTrimStrings(obj, maxStr = 500) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.length > maxStr) {
      out[k] = `${v.slice(0, maxStr)}…`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function serializePayload(payload) {
  if (payload == null) return null;
  let data = payload;
  if (typeof data === "object" && !Array.isArray(data)) {
    data = shallowTrimStrings(data);
  }
  try {
    const s = JSON.stringify(data);
    if (s.length <= MAX_JSON_BYTES) return data;
    return {
      _truncated: true,
      _originalBytes: s.length,
      preview: s.slice(0, 4000),
    };
  } catch (_) {
    return { _error: "payload_not_serializable" };
  }
}

/**
 * Best-effort insert; never throws. Use after successful mutating admin actions.
 * @param {{ action: string, targetType?: string|null, targetId?: string|number|null, payload?: unknown, req?: import('express').Request|null }} opts
 */
export async function appendAdminAuditLog(opts) {
  try {
    const action = String(opts?.action ?? "").trim().slice(0, 96);
    if (!action) return;
    const targetType =
      opts.targetType != null && String(opts.targetType).trim() !== ""
        ? String(opts.targetType).trim().slice(0, 32)
        : null;
    const targetId =
      opts.targetId != null && String(opts.targetId).trim() !== ""
        ? String(opts.targetId).trim().slice(0, 64)
        : null;
    const meta = extractRequestMeta(opts.req);
    await db("admin_audit_log").insert({
      action,
      target_type: targetType,
      target_id: targetId,
      payload_json: serializePayload(opts.payload),
      ip: meta.ip,
      user_agent: meta.user_agent,
    });
  } catch (err) {
    logger.warn({ err }, "appendAdminAuditLog failed");
  }
}
