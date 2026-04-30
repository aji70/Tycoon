"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export interface AgentBinding {
  key: string;
  slot: number;
  gameId: number | null;
  agentId: string;
  callbackUrl: string;
  name: string;
  registeredAt?: string;
}

export interface AgentBindingsResponse {
  bindings: AgentBinding[];
  myAgentOn: boolean;
}

/**
 * Fetches agent bindings for a game (which agents are registered, including "my agent plays for me" = slot 1).
 */
export function useAgentBindings(gameId: number | null | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["agent-bindings", gameId],
    queryFn: async (): Promise<AgentBindingsResponse> => {
      if (!gameId) return { bindings: [], myAgentOn: false };
      const res = await apiClient.get<ApiResponse<AgentBindingsResponse>>(`/games/${gameId}/agent-bindings`);
      if (!res.data?.success || !res.data.data) return { bindings: [], myAgentOn: false };
      return res.data.data;
    },
    enabled: !!gameId,
  });

  return {
    bindings: data?.bindings ?? [],
    myAgentOn: data?.myAgentOn ?? false,
    isLoading,
    error,
    refetch,
  };
}
