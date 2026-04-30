"use client";

import { TournamentDetailPage } from "@/components/tournaments/TournamentDetailPage";

export default function HumanTournamentDetailPage() {
  return <TournamentDetailPage basePath="/tournaments" expectedKind="human" />;
}
