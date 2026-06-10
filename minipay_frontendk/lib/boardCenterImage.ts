/** Center-of-board background by `game.board_id` (square names theme). */
const BOARD_CENTER_IMAGES: Record<string, string> = {
  kaduna_state: "/boards/kaduna.jpg",
  nigeria: "/boards/nigeria.jpg",
  ghana: "/boards/ghana.jpg",
  kenya: "/boards/kenya.jpg",
  africa: "/boards/africa.jpg",
  asia: "/boards/asia.jpg",
  indonesia: "/boards/indonesia.jpg",
  vietnam: "/boards/vietnam.jpg",
  philippines: "/boards/philippines.jpg",
  south_america: "/boards/southamerica.jpg",
  argentina: "/boards/argentina.jpg",
  brazil: "/boards/brazil.jpg",
  colombia: "/boards/colombia.jpg",
  world: "/boards/world.jpg",
  world_cup: "/boards/worldcup.jpg",
  uefa_champions_league: "/boards/ucl.jpg",
};

export function getBoardCenterImageUrl(boardId?: string | null): string {
  const id = (boardId ?? "default").trim().toLowerCase();
  if (!id || id === "default" || id === "metro") return "/bb.jpg";
  return BOARD_CENTER_IMAGES[id] ?? "/bb.jpg";
}
