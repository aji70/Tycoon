import { type ToastOptions } from "react-hot-toast";
import { gameBoardContractError } from "./gameBoardErrors";

/** react-hot-toast: show error only when message is non-empty (skips benign turn races). */
export function hotToastContractError(error: unknown, fallback: string, options?: ToastOptions): void {
  gameBoardContractError(error, fallback, options);
}
