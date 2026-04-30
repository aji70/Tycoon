import toast, { type ToastOptions } from "react-hot-toast";
import { getContractErrorMessage, isBenignTurnOrderError } from "./contractErrors";

/** react-hot-toast: show error only when message is non-empty (skips benign turn races). */
export function hotToastContractError(error: unknown, fallback: string, options?: ToastOptions): void {
  if (isBenignTurnOrderError(error)) return;
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  toast.error(msg, options);
}
