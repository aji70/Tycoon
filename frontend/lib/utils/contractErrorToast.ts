import { toast, type ToastOptions } from "react-toastify";
import { getContractErrorMessage, isUserRejectedTransaction } from "./contractErrors";

/** Like toast.error(getContractErrorMessage(...)) but skips benign turn-order races (no empty toast). */
export function toastContractError(error: unknown, fallback: string, options?: ToastOptions): void {
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  toast.error(msg, options);
}

export const CANCELLED_TX_TOAST = "You cancelled the transaction.";

/** Info for wallet cancel, error for real failures; skips benign races. */
export function toastTransactionOutcome(error: unknown, fallback: string, options?: ToastOptions): void {
  if (isUserRejectedTransaction(error)) {
    toast.info(CANCELLED_TX_TOAST, { autoClose: 2500, ...options });
    return;
  }
  const msg = getContractErrorMessage(error, fallback).trim();
  if (msg === CANCELLED_TX_TOAST) {
    toast.info(CANCELLED_TX_TOAST, { autoClose: 2500, ...options });
    return;
  }
  toastContractError(error, fallback, options);
}
