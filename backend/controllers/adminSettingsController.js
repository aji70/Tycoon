import logger from "../config/logger.js";
import { getChainConfig, getDefaultAppChain, isAnyChainConfigured, SUPPORTED_CHAINS } from "../config/chains.js";
import { isStarknetConfigured } from "../services/starknetContract.js";
import { getAdminRateLimitConfig } from "../config/adminDashboardSecurity.js";
import {
  isGoodDollarPlayOpenToAll,
  isMaintenanceModeEnabled,
  upsertSetting,
} from "../services/platformSettings.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

function chainPublicSnapshot(name) {
  const cfg = getChainConfig(name);
  return {
    chain: name,
    chainId: cfg.chainId,
    isConfigured: cfg.isConfigured,
    hasRpcUrl: Boolean(cfg.rpcUrl),
    hasTycoonContractAddress: Boolean(cfg.contractAddress),
    hasBackendGameControllerKey: Boolean(cfg.privateKey),
    hasTournamentEscrowAddress: Boolean(cfg.tournamentEscrowAddress),
    hasUsdcAddress: Boolean(cfg.usdcAddress),
    hasUserRegistryAddress: Boolean(cfg.userRegistryAddress),
    hasGameFaucetAddress: Boolean(cfg.gameFaucetAddress),
  };
}

/**
 * GET /api/admin/settings/summary
 * Non-secret configuration snapshot for operators (no keys, addresses, or RPC URLs).
 */
export async function getSettingsSummary(req, res) {
  try {
    const chains = SUPPORTED_CHAINS.map(chainPublicSnapshot);

    let maintenanceOn = false;
    try {
      maintenanceOn = await isMaintenanceModeEnabled();
    } catch (_) {
      maintenanceOn = false;
    }

    let gdPlayOpenToAll = false;
    try {
      gdPlayOpenToAll = await isGoodDollarPlayOpenToAll();
    } catch (_) {
      gdPlayOpenToAll = false;
    }

    const gdRequireEnv = process.env.GD_REQUIRE_FOR_MINIPAY_ACTIONS === "true";

    res.json({
      success: true,
      data: {
        runtime: {
          nodeEnv: process.env.NODE_ENV || "development",
          port: Number(process.env.PORT) || 3000,
          skipRedis: process.env.SKIP_REDIS === "true",
        },
        maintenance: { enabled: maintenanceOn },
        gooddollarPlayGate: {
          /** When true, create-game / Arena skip G$ Identity (admin testing). */
          open_to_all: gdPlayOpenToAll,
          /** Env still required for the gate to exist at all. */
          env_require_for_minipay: gdRequireEnv,
        },
        app: {
          defaultAppChain: getDefaultAppChain(),
          anyEvmChainConfigured: isAnyChainConfigured(),
          starknetConfigured: isStarknetConfigured(),
        },
        adminApiSecurity: {
          ipAllowlistEnabled: Boolean(
            process.env.TYCOON_ADMIN_IP_ALLOWLIST && String(process.env.TYCOON_ADMIN_IP_ALLOWLIST).trim()
          ),
          rateLimit: getAdminRateLimitConfig(),
        },
        integrations: {
          tyAdminSecretSet: Boolean(process.env.TYCOON_ADMIN_SECRET && String(process.env.TYCOON_ADMIN_SECRET).trim()),
          shopAdminSecretSet: Boolean(process.env.SHOP_ADMIN_SECRET && String(process.env.SHOP_ADMIN_SECRET).trim()),
          analyticsApiKeySet: Boolean(process.env.ANALYTICS_API_KEY && String(process.env.ANALYTICS_API_KEY).trim()),
          sentryDsnSet: Boolean(process.env.SENTRY_DSN && String(process.env.SENTRY_DSN).trim()),
          privyAppIdSet: Boolean(process.env.PRIVY_APP_ID && String(process.env.PRIVY_APP_ID).trim()),
          privyAppSecretSet: Boolean(process.env.PRIVY_APP_SECRET && String(process.env.PRIVY_APP_SECRET).trim()),
        },
        evmChains: chains,
        note: "Secrets and RPC URLs are never returned. Maintenance and GoodDollar play gate are stored in platform_settings.",
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getSettingsSummary error");
    res.status(500).json({ success: false, error: "Failed to load settings summary" });
  }
}

/**
 * PATCH /api/admin/settings/maintenance
 * Body: { enabled: boolean }
 */
export async function patchMaintenance(req, res) {
  try {
    const enabled = Boolean(req.body?.enabled);
    await upsertSetting("maintenance", { enabled });
    await appendAdminAuditLog({
      action: "settings.maintenance",
      targetType: "platform",
      targetId: "maintenance",
      payload: { enabled },
      req,
    });
    res.json({ success: true, data: { maintenance: { enabled } } });
  } catch (err) {
    logger.error({ err }, "admin patchMaintenance error");
    res.status(500).json({ success: false, error: "Failed to update maintenance mode" });
  }
}

/**
 * PATCH /api/admin/settings/gooddollar-play-gate
 * Body: { open_to_all: boolean }
 * open_to_all=true → anyone can create MiniPay games / Arena without G$ Face Verify.
 * open_to_all=false → only verified (or allowlisted) wallets when GD_REQUIRE_FOR_MINIPAY_ACTIONS=true.
 * Does not bypass daily claim G$ checks.
 */
export async function patchGoodDollarPlayGate(req, res) {
  try {
    const open_to_all = Boolean(req.body?.open_to_all);
    await upsertSetting("gooddollar_play_gate", { open_to_all });
    await appendAdminAuditLog({
      action: "settings.gooddollar_play_gate",
      targetType: "platform",
      targetId: "gooddollar_play_gate",
      payload: { open_to_all },
      req,
    });
    res.json({
      success: true,
      data: {
        gooddollarPlayGate: {
          open_to_all,
          env_require_for_minipay: process.env.GD_REQUIRE_FOR_MINIPAY_ACTIONS === "true",
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin patchGoodDollarPlayGate error");
    res.status(500).json({ success: false, error: "Failed to update GoodDollar play gate" });
  }
}
