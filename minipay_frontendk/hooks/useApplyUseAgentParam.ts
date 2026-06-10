"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";

/**
 * If the URL has ?useAgent=ID (agent id from My Agents), call use-my-agent for this game
 * once the user is in the game. Then remove the param from the URL.
 * Does nothing for API key — never put API keys in URLs (security).
 */
export function useApplyUseAgentParam(
  gameId: number | null | undefined,
  isInGame: boolean,
  refetchAgentBindings: () => void
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const appliedRef = useRef(false);

  useEffect(() => {
    const useAgentRaw = searchParams.get("useAgent");
    if (appliedRef.current || !gameId || !isInGame || !useAgentRaw) return;
    const agentId = parseInt(useAgentRaw, 10);
    if (Number.isNaN(agentId) || agentId < 1) return;

    appliedRef.current = true;

    apiClient
      .post(`/games/${gameId}/use-my-agent`, { user_agent_id: agentId })
      .then(() => {
        refetchAgentBindings();
        const next = new URLSearchParams(searchParams.toString());
        next.delete("useAgent");
        const q = next.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      })
      .catch(() => {
        appliedRef.current = false;
      });
  }, [gameId, isInGame, searchParams, pathname, router, refetchAgentBindings]);
}
