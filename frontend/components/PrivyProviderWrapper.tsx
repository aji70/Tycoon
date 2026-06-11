import type { ReactNode } from "react";

/** MiniPay build: no Privy — passthrough only. */
export default function PrivyProviderWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
