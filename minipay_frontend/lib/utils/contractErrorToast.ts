import { toast, type ToastOptions } from "react-toastify";
import { getContractErrorMessage, isUserRejectedTransaction } from "./contractErrors";

/** Like toast.error(getContractErrorMessage(...)) but skips benign turn-order races (no empty toast). */
export function toastContractError(error: unknown, fallback: string, options?: ToastOptions): void {
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  toast.error(msg, options);
}

/** Info for wallet cancel, error for real failures; skips benign races. */
export function toastTransactionOutcome(error: unknown, fallback: string, options?: ToastOptions): void {
  if (isUserRejectedTransaction(error)) {
    toast.info("Transaction cancelled", { autoClose: 2500, ...options });
    return;
  }
  const msg = getContractErrorMessage(error, fallback).trim();
  if (msg === "You cancelled the transaction.") {
    toast.info("Transaction cancelled", { autoClose: 2500, ...options });
    return;
  }
  toastContractError(error, fallback, options);
}
