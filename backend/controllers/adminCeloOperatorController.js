import {
  assertOperatorToolsEnabled,
  createAIGamesForAllOperatorWallets,
  encodeDistributorFundEqual,
  getOperatorToolsStatus,
  getOperatorWalletsSortedByBalanceDesc,
  parseWeiFromCeloString,
  registerAllOperatorWallets,
  touchDistributorFromAllOperatorWallets,
} from "../services/celoOperatorToolsService.js";

export async function getStatus(req, res) {
  try {
    const data = await getOperatorToolsStatus();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function postRegister(req, res) {
  try {
    assertOperatorToolsEnabled();
    const delayMs = Number(req.body?.delayMs) || 0;
    const out = await registerAllOperatorWallets({ delayMs });
    return res.json({ success: true, data: out });
  } catch (err) {
    const code = err.code === "CELO_OPERATOR_DISABLED" || err.code === "CELO_OPERATOR_NO_KEYS" ? 403 : 400;
    return res.status(code).json({ success: false, message: err.message, code: err.code });
  }
}

export async function postCreateAiGames(req, res) {
  try {
    assertOperatorToolsEnabled();
    const delayMs = Number(req.body?.delayMs) || 0;
    const gamesPerWallet = Number(req.body?.gamesPerWallet) || 1;
    const startingBalance = req.body?.startingBalance ?? 1500;
    const gameType = req.body?.gameType;
    const playerSymbol = req.body?.playerSymbol;
    const numberOfAI = req.body?.numberOfAI;
    const out = await createAIGamesForAllOperatorWallets({
      delayMs,
      gamesPerWallet,
      startingBalance,
      gameType,
      playerSymbol,
      numberOfAI,
    });
    return res.json({ success: true, data: out });
  } catch (err) {
    const code = err.code === "CELO_OPERATOR_DISABLED" || err.code === "CELO_OPERATOR_NO_KEYS" ? 403 : 400;
    return res.status(code).json({ success: false, message: err.message, code: err.code });
  }
}

/** Build distributor tx payload for equal CELO per configured operator address (funding gas). */
export async function postDistributorPayload(req, res) {
  try {
    assertOperatorToolsEnabled();
    const celoPerWallet = req.body?.celoPerWallet ?? "0.5";
    const wei = parseWeiFromCeloString(celoPerWallet);
    const wallets = await getOperatorWalletsSortedByBalanceDesc();
    const recipients = wallets.map((w) => w.address);
    const payload = encodeDistributorFundEqual(recipients, wei);
    return res.json({ success: true, data: { ...payload, recipientCount: recipients.length, celoPerWallet } });
  } catch (err) {
    const code = err.code === "CELO_OPERATOR_DISABLED" || err.code === "CELO_OPERATOR_NO_KEYS" ? 403 : 400;
    return res.status(code).json({ success: false, message: err.message, code: err.code });
  }
}

export async function postTouchDistributor(req, res) {
  try {
    assertOperatorToolsEnabled();
    const delayMs = Number(req.body?.delayMs) || 0;
    const out = await touchDistributorFromAllOperatorWallets({ delayMs });
    return res.json({ success: true, data: out });
  } catch (err) {
    const code = err.code === "CELO_OPERATOR_DISABLED" || err.code === "CELO_OPERATOR_NO_KEYS" ? 403 : 400;
    return res.status(code).json({ success: false, message: err.message, code: err.code });
  }
}
