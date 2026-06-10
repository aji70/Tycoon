/**
 * Shared utility to normalize contract/transaction error messages for toast display.
 * Matches the pattern used in the settings page for consistent UX.
 */

/**
 * Benign races (stale client, fast agent runner, double-submit): do not toast.
 * Includes turn-order and change-position / payRent failures that recover on refetch.
 */
const BENIGN_TURN_SUBSTRINGS = [
  "not your turn",
  "not the current player",
  "already rolled",
  "must roll",
  "you already rolled",
  "it's not your turn",
  "it is not your turn",
  "its not your turn",
  "not your turn to roll",
  "cannot end another player",
  "failed to process property action",
];

const USER_REJECTED_SUBSTRINGS = [
  "userrejectedrequesterror",
  "connectoruserrejectederror",
  "user rejected",
  "user denied",
  "user cancelled",
  "user canceled",
  "transaction cancelled",
  "transaction canceled",
  "rejected the request",
  "rejected transaction",
  "user rejected transaction",
  "request rejected",
  "signature rejected",
  "denied transaction",
  "denied signature",
  "action_rejected",
  "action rejected",
  "declined",
  "disapproved",
  "refused",
  "aborted",
  "cancelled by user",
  "canceled by user",
];

/** Walk viem/wagmi nested `cause` chain and collect text for matching. */
function walkErrorChain(error: unknown, maxDepth = 10): string[] {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current && depth < maxDepth) {
    if (typeof current !== "object" || current === null) break;
    if (seen.has(current)) break;
    seen.add(current);

    const e = current as {
      name?: string;
      message?: string;
      shortMessage?: string;
      code?: number | string;
      metaMessages?: unknown;
      details?: string;
      data?: { message?: string; error?: string };
      response?: { data?: { message?: string; error?: string } };
      cause?: unknown;
    };

    if (e.name) parts.push(e.name);
    if (e.message) parts.push(e.message);
    if (e.shortMessage) parts.push(e.shortMessage);
    if (e.details) parts.push(e.details);
    if (e.code !== undefined && e.code !== null) parts.push(String(e.code));
    if (Array.isArray(e.metaMessages)) {
      for (const m of e.metaMessages) {
        if (typeof m === "string") parts.push(m);
      }
    }
    const d = e.response?.data;
    if (d && typeof d === "object") {
      if (typeof d.message === "string") parts.push(d.message);
      if (typeof d.error === "string") parts.push(d.error);
    }
    const top = e.data;
    if (top && typeof top === "object") {
      if (typeof top.message === "string") parts.push(top.message);
      if (typeof top.error === "string") parts.push(top.error);
    }

    current = e.cause;
    depth++;
  }

  return parts;
}

function collectErrorText(error: unknown): string {
  return walkErrorChain(error).join(" ").toLowerCase();
}

function hasRejectedCode(error: unknown): boolean {
  for (const part of walkErrorChain(error)) {
    const code = String(part).trim();
    if (code === "4001" || code === "ACTION_REJECTED") return true;
  }
  return false;
}

export function isBenignTurnOrderError(error: unknown): boolean {
  const hay = collectErrorText(error);
  return BENIGN_TURN_SUBSTRINGS.some((s) => hay.includes(s));
}

/** Wallet popup dismissed or user rejected signing (wagmi/viem / WalletConnect / MetaMask). */
export function isUserRejectedTransaction(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error === "string") {
    const hay = error.toLowerCase();
    return USER_REJECTED_SUBSTRINGS.some((s) => hay.includes(s));
  }
  if (hasRejectedCode(error)) return true;
  const hay = collectErrorText(error);
  return USER_REJECTED_SUBSTRINGS.some((s) => hay.includes(s));
}

/** Strip viem/wagmi diagnostic tails before showing in a toast. */
export function sanitizeContractToastMessage(message: string): string {
  let msg = message.trim();
  const docsIdx = msg.indexOf("Docs:");
  if (docsIdx >= 0) msg = msg.slice(0, docsIdx).trim();
  const versionIdx = msg.indexOf("Version: viem@");
  if (versionIdx >= 0) msg = msg.slice(0, versionIdx).trim();
  const contractCallIdx = msg.indexOf("Contract Call:");
  if (contractCallIdx >= 0) msg = msg.slice(0, contractCallIdx).trim();
  return msg;
}

export function getContractErrorMessage(
  error: unknown,
  defaultMessage = "Transaction failed. Check your connection and try again, or refresh the page."
): string {
  const e = error as {
    code?: number;
    status?: number;
    message?: string;
    shortMessage?: string;
    cause?: { name?: string };
    response?: { status?: number; data?: { message?: string; error?: string } };
    data?: { message?: string; error?: string };
  };

  if (isUserRejectedTransaction(error)) {
    return "You cancelled the transaction.";
  }

  // Stale turn / double-submit races — never show a toast (all board paths use this helper or should).
  if (isBenignTurnOrderError(error)) return "";

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

  // Backend API errors (status on axios response or ApiError.status)
  const httpStatus = e?.response?.status ?? e?.status;
  if (httpStatus === 400 || httpStatus === 422) {
    const msg = (e?.response?.data?.message ?? e?.data?.message ?? "").toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      return "Game code already taken. Try again in a moment.";
    }
    if (msg.includes("invalid stake") || msg.includes("minimum")) {
      return "Invalid stake amount.";
    }
    const msgClient = e?.response?.data?.message ?? e?.data?.message;
    if (msgClient && typeof msgClient === "string") {
      if (isBenignTurnOrderError({ response: { data: { message: msgClient } } })) return "";
      return msgClient;
    }
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

  const backendMsgRaw =
    e?.response?.data?.message ?? e?.response?.data?.error ?? e?.data?.message ?? e?.data?.error;
  const backendStr = typeof backendMsgRaw === "string" ? backendMsgRaw.toLowerCase() : "";

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
  const backendMsg =
    e?.response?.data?.message ?? e?.response?.data?.error ?? e?.data?.message ?? e?.data?.error;
  if (backendMsg && typeof backendMsg === "string") {
    const slice = backendMsg.slice(0, 140);
    if (isBenignTurnOrderError({ message: slice })) return "";
    return slice;
  }

  // Use explicit message if available (truncate long messages)
  const rawMsg = e?.shortMessage ?? e?.message ?? "";
  if (rawMsg && typeof rawMsg === "string") {
    if (isUserRejectedTransaction({ message: rawMsg, shortMessage: rawMsg })) {
      return "You cancelled the transaction.";
    }
    const trimmed = sanitizeContractToastMessage(rawMsg).slice(0, 140);
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
