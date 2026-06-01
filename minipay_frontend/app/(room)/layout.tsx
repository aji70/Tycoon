import { GameProvider } from "@/context/game-context";

/** Wagmi/3D room pages must not be statically prerendered (no wallet on the server). */
export const dynamic = "force-dynamic";

export default function RoomLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <GameProvider>{children}</GameProvider>;
}
