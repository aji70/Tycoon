"use client";

import { CreateTournamentClient } from "@/components/tournaments/CreateTournamentClient";
import { HUMAN_TOURNAMENTS_BASE, tournamentCreatePath } from "@/lib/tournamentRoutes";

export default function CreateHumanTournamentPage() {
  return (
    <CreateTournamentClient
      variant="human"
      listHref={HUMAN_TOURNAMENTS_BASE}
      createHref={tournamentCreatePath("human")}
      detailBasePath={HUMAN_TOURNAMENTS_BASE}
      listLabel="Tournaments"
      pageTitle="Create tournament"
    />
  );
}
