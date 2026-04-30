import { toast, type ToastOptions } from "react-toastify";
import { getContractErrorMessage } from "./contractErrors";

/** Like toast.error(getContractErrorMessage(...)) but skips benign turn-order races (no empty toast). */
export function toastContractError(error: unknown, fallback: string, options?: ToastOptions): void {
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  toast.error(msg, options);
}
