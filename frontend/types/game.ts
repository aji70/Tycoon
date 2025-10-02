export interface GameContextProps {
  isAppearanceModalOpen: boolean;
  setAppearanceModalOpen: (isOpen: boolean) => void;
  players: Player[];
  setPlayers: (players: Player[]) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}

export interface BoardDataSquare {
  id: number;
  type: "corner" | "property" | "special";
  name: string;
  price: number;
  rent_site_only: number;
  rent_one_house: number;
  rent_two_houses: number;
  rent_three_houses: number;
  rent_four_houses: number;
  rent_hotel: number;
  cost_of_house: number;
  is_mortgaged: boolean;
  group_id: number;
  color: string;
  position: "top" | "bottom" | "left" | "right";
  grid_row: number;
  grid_col: number;
  icon: string;
}

export type Position = "bottom" | "left" | "top" | "right";
export interface Game {
  id: number;
  code: string;
  mode: "PUBLIC" | "PRIVATE";
  creator_id: number;
  status: "WAITING" | "RUNNING" | "FINISHED" | "CANCELLED";
  winner_id: number | null;
  number_of_players: number;
  next_player_id: number | null;
  created_at: string;
  updated_at: string;
  settings: GameSettings;
  players: Player[];
}

export interface GameSettings {
  auction: number;
  mortgage: number;
  even_build: number;
  randomize_play_order: number;
  starting_cash: number;
}

export interface Player {
  user_id: number;
  address: string;
  chance_jail_card: number;
  community_chest_jail_card: number;
  balance: number;
  position: number;
  turn_order: number | null;
  symbol: string;
  joined_date: string;
  username: string;
}

export interface Property {
  id: number;
  type: string;
  name: string;
  group_id: number;
  position: Position;
  grid_row: number;
  grid_col: number;
  price: number;
  rent_site_only: number;
  rent_one_house: number;
  rent_two_houses: number;
  rent_three_houses: number;
  rent_four_houses: number;
  rent_hotel: number;
  cost_of_house: number;
  is_mortgaged: boolean;
  color: string;
  icon?: string | null;
}

export interface GameProperty {
  id: number;
  game_id: number;
  address: string;
  player_id: number;
  property_id: number;
  mortgaged: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export type OwnedProperty = GameProperty & Property;

export const PROPERTY_POSITION = [
  1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37,
  39,
];

export const NO_PROPERTY_POSITION = [
  0, 2, 4, 5, 7, 10, 12, 15, 17, 20, 22, 25, 28, 30, 33, 35, 36,
];

export const RAILWAY_POSITION = [5, 15, 25, 35];

export const UTILITY_POSITION = [12, 28];

export const COMMUNITY_CHEST_POSITION = [2, 17, 33];

export const CHANCE_POSITION = [7, 22, 36];

export const GOTO_JAIL_POSITION = 30;

export const VISITING_JAIL_POSITION = 10;

export const START_POSITION = 0;

export const FREE_PACKING_POSITION = 20;

export const INCOME_TAX_POSITION = 4;

export const LUXURY_TAX_POSITION = 38;
