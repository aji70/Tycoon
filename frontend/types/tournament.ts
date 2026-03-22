/** Who can see / join the tournament from Arena. */
export type TournamentVisibility = "OPEN" | "INVITE_ONLY" | "BOT_SELECTION";

/** Tournament prize source. */
export type PrizeSource = "NO_POOL" | "ENTRY_FEE_POOL" | "CREATOR_FUNDED";

/** Tournament status. */
export type TournamentStatus =
  | "REGISTRATION_OPEN"
  | "BRACKET_LOCKED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Bracket format (backend). */
export type TournamentFormat =
  | "SINGLE_ELIMINATION"
  | "ROUND_ROBIN"
  | "SWISS"
  | "BATTLE_ROYALE"
  | "GROUP_ELIMINATION";

/** Entry status. */
export type EntryStatus = "REGISTERED" | "CONFIRMED" | "DISQUALIFIED";

/** Round status. */
export type RoundStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

/** Match status. */
export type MatchStatus = "PENDING" | "AWAITING_PLAYERS" | "IN_PROGRESS" | "COMPLETED" | "BYE";

/** Slot type in a match. */
export type SlotType = "ENTRY" | "MATCH_WINNER" | "BYE";

export interface Tournament {
  id: number;
  code?: string;
  creator_id: number;
  /** Creator wallet address (for recognizing creator when using wallet without guest login). */
  creator_address?: string | null;
  /** Set when GET uses ?invite= (invite-only) or you are the creator. */
  invite_token?: string | null;
  visibility?: TournamentVisibility;
  /** Parsed allowlist for BOT_SELECTION (from API). */
  allowed_agent_ids?: number[] | null;
  is_agent_only?: boolean;
  is_creator?: boolean;
  name: string;
  format?: TournamentFormat;
  status: TournamentStatus;
  prize_source: PrizeSource;
  max_players: number;
  min_players: number;
  /** Number of registered participants (included in list API). */
  participant_count?: number;
  entry_fee_wei: string | number;
  prize_pool_wei: string | null;
  prize_distribution: Record<string, number> | null;
  registration_deadline: string | null;
  chain: string;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentEntry {
  id: number;
  tournament_id: number;
  user_id: number;
  address: string | null;
  chain: string | null;
  seed_order: number | null;
  payment_tx_hash: string | null;
  status: EntryStatus;
  username?: string;
  /** Bound agent display name (invited-bot / agents-only events). */
  agent_name?: string | null;
  user_agent_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentRound {
  id: number;
  tournament_id: number;
  round_index: number;
  status: RoundStatus;
  started_at: string | null;
  completed_at: string | null;
  scheduled_start_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentMatch {
  id: number;
  tournament_id: number;
  round_index: number;
  match_index: number;
  slot_a_type: SlotType;
  slot_a_entry_id: number | null;
  slot_a_prev_match_id: number | null;
  slot_b_type: SlotType;
  slot_b_entry_id: number | null;
  slot_b_prev_match_id: number | null;
  /** Multiplayer tables (2–4); when set, slots A/B are the first two seats. */
  participant_entry_ids?: number[] | null;
  game_id: number | null;
  contract_game_id: string | null;
  winner_entry_id: number | null;
  status: MatchStatus;
  spectator_token?: string | null;
  spectator_url?: string | null;
  slot_a_username?: string | null;
  slot_b_username?: string | null;
  winner_username?: string | null;
  /** Joined from games row when present (GET tournament detail). */
  match_game_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentDetail extends Tournament {
  entries: TournamentEntry[];
  rounds: TournamentRound[];
  matches: TournamentMatch[];
}

export interface BracketRound {
  round_index: number;
  status: RoundStatus;
  scheduled_start_at?: string | null;
  matches: {
    id: number;
    match_index: number;
    slot_a_entry_id: number | null;
    slot_b_entry_id: number | null;
    participant_entry_ids?: number[] | null;
    slot_a_type: SlotType;
    slot_b_type: SlotType;
    winner_entry_id: number | null;
    game_id: number | null;
    contract_game_id: string | null;
    status: MatchStatus;
    spectator_token?: string | null;
    spectator_url?: string | null;
    slot_a_username: string | null;
    slot_b_username: string | null;
    winner_username: string | null;
    /** Present when bracket is loaded from GET .../bracket (joined from games). */
    match_game_type?: string | null;
  }[];
}

export interface Bracket {
  tournament: { id: number; name: string; status: TournamentStatus };
  rounds: BracketRound[];
}

export interface LeaderboardEntry {
  rank: number;
  entry_id: number;
  user_id: number;
  username: string;
  agent_name?: string | null;
  address: string | null;
  eliminated_in_round: number | null;
  is_winner: boolean;
  payout_wei: string | null;
}

export interface LeaderboardData {
  tournament_id: number;
  phase: "live" | "final";
  entries: LeaderboardEntry[];
}

/** Create tournament API response: tournament plus on-chain creation result. */
export interface CreateTournamentResponse extends Tournament {
  created_on_chain: boolean;
  on_chain_error: string | null;
  on_chain_tx_hash: string | null;
}

/** Create tournament body (backend expects chain required). */
export interface CreateTournamentBody {
  name: string;
  chain: string;
  format?: TournamentFormat;
  prize_source?: PrizeSource;
  max_players?: number;
  min_players?: number;
  entry_fee_wei?: number;
  prize_pool_wei?: string | null;
  prize_distribution?: Record<string, number> | null;
  registration_deadline?: string | null;
  visibility?: TournamentVisibility;
  /** Required when visibility is BOT_SELECTION — discoverable agent IDs. */
  allowed_agent_ids?: number[];
  is_agent_only?: boolean;
}

/** Register body: address + chain for wallet users; backend uses auth user or address. */
export interface RegisterTournamentBody {
  address?: string;
  chain?: string;
  payment_tx_hash?: string | null;
  invite_token?: string;
  user_agent_id?: number;
}
