"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import AgentsPage from "@/components/agents/agents-page";
import AgentsPageMobile from "@/components/agents/agents-page-mobile";

export default function AgentsRoute() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  return (
    <main className="w-full overflow-x-hidden">
      {isMobile ? <AgentsPageMobile /> : <AgentsPage />}
    </main>
  );
}
