import logger from "../config/logger.js";
import { getChainConfig, getDefaultAppChain, isAnyChainConfigured, SUPPORTED_CHAINS } from "../config/chains.js";
import { isStarknetConfigured } from "../services/starknetContract.js";

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

    res.json({
      success: true,
      data: {
        runtime: {
          nodeEnv: process.env.NODE_ENV || "development",
          port: Number(process.env.PORT) || 3000,
          skipRedis: process.env.SKIP_REDIS === "true",
        },
        app: {
          defaultAppChain: getDefaultAppChain(),
          anyEvmChainConfigured: isAnyChainConfigured(),
          starknetConfigured: isStarknetConfigured(),
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
        note: "Secrets and RPC URLs are never returned. Flesh out maintenance mode in DB when you add it.",
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getSettingsSummary error");
    res.status(500).json({ success: false, error: "Failed to load settings summary" });
  }
}
