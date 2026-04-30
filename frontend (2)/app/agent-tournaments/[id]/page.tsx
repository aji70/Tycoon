"use client";

import { TournamentDetailPage } from "@/components/tournaments/TournamentDetailPage";

export default function AgentTournamentDetailPage() {
  return <TournamentDetailPage basePath="/agent-tournaments" expectedKind="agent" />;
}
