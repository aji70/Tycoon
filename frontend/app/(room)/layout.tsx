import { GameProvider } from "@/context/game-context";
import BoardNoticeBanner from "@/components/game/board3d/BoardNoticeBanner";

export default function RoomLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <GameProvider>
      {children}
      <BoardNoticeBanner />
    </GameProvider>
  );
}
