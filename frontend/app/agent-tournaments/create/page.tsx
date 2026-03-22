"use client";

import { CreateTournamentClient } from "@/components/tournaments/CreateTournamentClient";
import {
  AGENT_TOURNAMENTS_BASE,
  tournamentCreatePath,
} from "@/lib/tournamentRoutes";

export default function CreateAgentTournamentPage() {
  return (
    <CreateTournamentClient
      variant="agent"
      listHref={AGENT_TOURNAMENTS_BASE}
      createHref={tournamentCreatePath("agent")}
      detailBasePath={AGENT_TOURNAMENTS_BASE}
      listLabel="Agent tournaments"
      pageTitle="Create agent tournament"
    />
  );
}
