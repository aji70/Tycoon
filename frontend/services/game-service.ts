import { apiClient } from "@/lib/api";
export interface GamePlayer {
  id: string;
  symbol: string;
  name: string;
}

export interface GameData {
  id: number;
  code: string;
  number_of_players: number;
  players_joined: number;
  players: GamePlayer[];
  status: string;
}

export const gameService = {
  async getGameByCode(code: string): Promise<GameData> {
    return apiClient.get<GameData>(`/games/code/${code}`);
  },

  async leaveGame(gameId: number, symbol: string): Promise<GameData> {
    return apiClient.post<GameData>(`/games/${gameId}/leave`, { symbol });
  },
};
