/**
 * Shared utility to normalize contract/transaction error messages for toast display.
 * Matches the pattern used in the settings page for consistent UX.
 */

/** Benign race when agents / polling act out of sync with turn state — do not toast. */
const BENIGN_TURN_SUBSTRINGS = [
  "not your turn",
  "not the current player",
  "already rolled",
  "must roll",
  "you already rolled",
  "it's not your turn",
  "it is not your turn",
  "not your turn to roll",
  "cannot end another player",
];

function collectErrorText(error: unknown): string {
  const e = error as {
    message?: string;
    shortMessage?: string;
    response?: { data?: { message?: string; error?: string } };
  };
  const parts: string[] = [];
  if (e?.message) parts.push(e.message);
  if (e?.shortMessage) parts.push(e.shortMessage);
  const d = e?.response?.data;
  if (d && typeof d === "object") {
    if (typeof d.message === "string") parts.push(d.message);
    if (typeof d.error === "string") parts.push(d.error);
  }
  return parts.join(" ").toLowerCase();
}

export function isBenignTurnOrderError(error: unknown): boolean {
  const hay = collectErrorText(error);
  return BENIGN_TURN_SUBSTRINGS.some((s) => hay.includes(s));
}

export function getContractErrorMessage(
  error: unknown,
  defaultMessage = "Transaction failed. Check your connection and try again, or refresh the page."
): string {
  const e = error as {
    code?: number;
    message?: string;
    shortMessage?: string;
    cause?: { name?: string };
    response?: { status?: number; data?: { message?: string; error?: string } };
  };

  // User rejected / cancelled (wagmi/viem 4001)
  if (
    e?.code === 4001 ||
    e?.shortMessage?.includes("User rejected") ||
    e?.message?.toLowerCase().includes("user rejected") ||
    e?.message?.toLowerCase().includes("user denied") ||
    e?.message?.toLowerCase().includes("transaction cancelled")
  ) {
    return "You cancelled the transaction.";
  }

  // Insufficient funds for gas
  if (
    e?.message?.toLowerCase().includes("insufficient funds") ||
    e?.shortMessage?.includes("insufficient funds") ||
    e?.message?.toLowerCase().includes("insufficient balance")
  ) {
    return "Not enough funds for gas fees.";
  }

  // Insufficient balance or allowance for ERC20
  if (e?.message?.toLowerCase().includes("insufficient")) {
    return "Insufficient balance or gas.";
  }

  // Contract revert: AI game specific (wrong network or game type)
  const errMsg = (e?.message ?? e?.shortMessage ?? "").toLowerCase();
  if (errMsg.includes("not an ai game") || errMsg.includes("only creator can end ai game")) {
    return "This game isn't an AI game on-chain. Make sure your wallet is on the same network you used when creating the game (e.g. Celo).";
  }

  // Contract revert / execution reverted
  if (
    e?.cause?.name === "ExecutionRevertedError" ||
    e?.message?.toLowerCase().includes("execution reverted") ||
    e?.shortMessage?.toLowerCase().includes("execution reverted")
  ) {
    return "Smart contract rejected transaction (check balance/stake).";
  }

  // Backend API errors
  if (e?.response?.status === 400) {
    const msg = (e?.response?.data?.message ?? "").toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      return "Game code already taken. Try again in a moment.";
    }
    if (msg.includes("invalid stake") || msg.includes("minimum")) {
      return "Invalid stake amount.";
    }
    const msg400 = e?.response?.data?.message;
    if (msg400 && typeof msg400 === "string") return msg400;
  }

  if (e?.response?.status === 429) {
    return "Too many requests — please wait a moment before trying again.";
  }

  // Connection / network errors
  const msgLower = (e?.message ?? e?.shortMessage ?? "").toLowerCase();
  if (
    msgLower.includes("network") ||
    msgLower.includes("fetch failed") ||
    msgLower.includes("econnreset") ||
    msgLower.includes("econnrefused") ||
    msgLower.includes("timeout") ||
    msgLower.includes("failed to fetch")
  ) {
    return "Connection problem. Check your network and try again.";
  }

  // Turn / roll races: fail quietly in UI (agents + fast polling); see toastContractError / isBenignTurnOrderError
  const backendMsgRaw = e?.response?.data?.message ?? e?.response?.data?.error;
  const backendStr = typeof backendMsgRaw === "string" ? backendMsgRaw.toLowerCase() : "";
  if (isBenignTurnOrderError(error)) {
    return "";
  }

  if (backendStr.includes("timeout") || backendStr.includes("timed out")) {
    return "Turn timed out. You can try again next round, or rejoin the game with your code if you were disconnected.";
  }

  if (e?.response?.status === 404) {
    return "Game or resource not found. Check the game code and try rejoining.";
  }

  if (e?.response?.status === 503 || e?.response?.status === 502) {
    return "Server temporarily unavailable. Wait a moment and try again.";
  }

  // Prefer backend message so we don't show generic "API request failed" when we have context
  const backendMsg = e?.response?.data?.message ?? e?.response?.data?.error;
  if (backendMsg && typeof backendMsg === "string") {
    const slice = backendMsg.slice(0, 140);
    if (isBenignTurnOrderError({ message: slice })) return "";
    return slice;
  }

  // Use explicit message if available (truncate long messages)
  const msg = e?.shortMessage ?? e?.message ?? "";
  if (msg && typeof msg === "string") {
    const trimmed = msg.slice(0, 140);
    if (isBenignTurnOrderError({ message: trimmed })) return "";
    // Don't surface generic API messages; use the caller's default (e.g. "Failed to vote")
    if (
      trimmed === "API request failed" ||
      trimmed === "No response from server"
    ) {
      return defaultMessage;
    }
    return trimmed;
  }

  return defaultMessage;
}
