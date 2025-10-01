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
  position: string;
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
  address: string,
  player_id: number;
  property_id: number;
  mortgaged: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export type OwnedProperty = GameProperty & Property;