import db from "../config/database.js";
import logger from "../config/logger.js";

const CACHE_TTL_MS = 4000;
let cache = {
  maintenance: { v: false, at: 0 },
  economy: { v: null, at: 0 },
};

export function clearPlatformSettingsCache() {
  cache.maintenance = { v: false, at: 0 };
  cache.economy = { v: null, at: 0 };
}

async function readRow(key) {
  try {
    const has = await db.schema.hasTable("platform_settings");
    if (!has) return null;
    return await db("platform_settings").where({ setting_key: key }).first();
  } catch (err) {
    logger.warn({ err, key }, "platform_settings read failed");
    return null;
  }
}

function parseJson(text) {
  if (text == null) return null;
  if (typeof text === "object") return text;
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<boolean>}
 */
export async function isMaintenanceModeEnabled() {
  const now = Date.now();
  if (now - cache.maintenance.at < CACHE_TTL_MS) {
    return cache.maintenance.v;
  }
  const row = await readRow("maintenance");
  const parsed = parseJson(row?.value_json);
  const on = parsed && typeof parsed === "object" && parsed.enabled === true;
  cache.maintenance = { v: !!on, at: now };
  return cache.maintenance.v;
}

/**
 * Economy overrides stored under key "economy_daily_claim" as
 * { dailyRewardTycBase?: string, streakBonusTycPerDay?: number }
 * Missing fields fall back to env.
 */
export async function getEconomyDailyClaimOverrides() {
  const now = Date.now();
  if (cache.economy.v != null && now - cache.economy.at < CACHE_TTL_MS) {
    return cache.economy.v;
  }
  const row = await readRow("economy_daily_claim");
  const parsed = parseJson(row?.value_json);
  const out =
    parsed && typeof parsed === "object"
      ? {
          dailyRewardTycBase:
            parsed.dailyRewardTycBase != null && String(parsed.dailyRewardTycBase).trim() !== ""
              ? String(parsed.dailyRewardTycBase).trim()
              : null,
          streakBonusTycPerDay:
            parsed.streakBonusTycPerDay != null && Number.isFinite(Number(parsed.streakBonusTycPerDay))
              ? Number(parsed.streakBonusTycPerDay)
              : null,
        }
      : { dailyRewardTycBase: null, streakBonusTycPerDay: null };
  cache.economy = { v: out, at: now };
  return out;
}

/**
 * Effective daily-claim tuning: DB overrides win over env when set.
 */
export async function getEffectiveDailyClaimConfig() {
  const o = await getEconomyDailyClaimOverrides();
  const base = o.dailyRewardTycBase ?? process.env.DAILY_REWARD_TYC_BASE ?? "1";
  const streakBonus =
    o.streakBonusTycPerDay != null
      ? Number(o.streakBonusTycPerDay)
      : Number(process.env.DAILY_REWARD_STREAK_BONUS_TYC ?? "0.5");
  const hasDbOverride = o.dailyRewardTycBase != null || o.streakBonusTycPerDay != null;
  return {
    dailyRewardTycBase: base,
    streakBonusTycPerDay: Number.isFinite(streakBonus) ? streakBonus : 0.5,
    source: hasDbOverride ? "db_override" : "env",
  };
}

/**
 * Upsert JSON value for a setting key.
 */
export async function upsertSetting(key, valueObj) {
  const has = await db.schema.hasTable("platform_settings");
  if (!has) {
    throw new Error("platform_settings table missing; run migrations");
  }
  const json = JSON.stringify(valueObj ?? {});
  const exists = await db("platform_settings").where({ setting_key: key }).first();
  if (exists) {
    await db("platform_settings").where({ setting_key: key }).update({ value_json: json, updated_at: new Date() });
  } else {
    await db("platform_settings").insert({ setting_key: key, value_json: json, updated_at: new Date() });
  }
  clearPlatformSettingsCache();
}
