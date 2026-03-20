import toast, { type ToastOptions } from "react-hot-toast";
import { getContractErrorMessage } from "./contractErrors";

/** react-hot-toast: show error only when message is non-empty (skips benign turn races). */
export function hotToastContractError(error: unknown, fallback: string, options?: ToastOptions): void {
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  toast.error(msg, options);
}
