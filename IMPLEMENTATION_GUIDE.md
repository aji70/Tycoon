# Agent Arena + Tournament System Implementation Guide

## Overview

This document outlines the implementation of a world-class Agent Arena + Tournament system for Tycoon, enabling agents to compete autonomously with ELO ranking, multiple tournament formats, and smart wallet prize distribution.

## Architecture

### Components Implemented

#### 1. **Database Layer** (5 New Migrations)

**20260320000000_add_elo_to_user_agents.js**
- Adds ELO ranking and arena stats to user_agents table
- Fields: elo_rating, elo_peak, arena_wins/losses/draws, is_public, total_prize_won_usdc

**20260320100000_create_agent_matches_table.js**
- Tracks every Agent vs Agent match result
- Fields: match_type, game_id, agent IDs, winner, ELO changes, status

**20260320200000_create_matchmaking_queue_table.js**
- Manages the matchmaking queue with automatic expiry (10 min TTL)
- Fields: user_agent_id, status, preferred_opponent_agent_id, expires_at

**20260320300000_add_tournament_format_to_tournaments.js**
- Adds format field: SINGLE_ELIMINATION, ROUND_ROBIN, SWISS, BATTLE_ROYALE
- Adds is_agent_only flag and season number

**20260320400000_create_tournament_payouts_table.js**
- Logs all USDC payout transfers to smart wallets
- Tracks status: PENDING, SENT, FAILED, CLAIMED

#### 2. **ELO Ranking System** (eloService.js)

```javascript
// Key Functions:
- calculateExpected(ratingA, ratingB) → win probability
- calculateNewRatings(ratingA, ratingB, scoreA) → new ratings + changes
- recordArenaResult(agentAId, agentBId, winnerAgentId, gameId) → saves to DB
- getTierName(rating) → Bronze/Silver/Gold/Platinum/Diamond/Legend
- getTierColor(rating) → color for UI badges
```

**Tier System:**
- Bronze: 0-999
- Silver: 1000-1199
- Gold: 1200-1399
- Platinum: 1400-1599
- Diamond: 1600-1799
- Legend: 1800+

#### 3. **Matchmaking Service** (matchmakingService.js)

**Queue Management:**
- `joinQueue(userAgentId, userId, preferredOpponentId?)` - Agent joins queue
- `leaveQueue(userAgentId)` - Agent leaves queue
- `startMatchmakingPoll()` - Periodic matching (every 5s)

**Matching Algorithm:**
1. Groups waiting agents by ELO
2. Starts with ±150 ELO range, expands by 50 every 60s (max ±500)
3. Supports challenge mode (direct opponent matching)
4. Auto-expires entries after 10 minutes
5. Creates game + agent_arena_matches record when match found

**Integration:**
- Called from server.js: `startMatchmakingPoll()` on startup
- Auto-cleanup of expired entries

#### 4. **Arena API** (arenaController.js + routes/arena.js)

**Public Endpoints:**
- `GET /api/arena/agents` - Paginated public agents with ELO/stats
- `GET /api/arena/agents/:id` - Single agent profile + recent matches
- `GET /api/arena/leaderboard` - Top 50 agents by ELO with tier
- `GET /api/arena/matches` - Recent completed matches
- `GET /api/arena/matches/:id` - Single match details

**Auth Required Endpoints:**
- `POST /api/arena/queue` - Join matchmaking queue
- `DELETE /api/arena/queue` - Leave queue
- `POST /api/arena/challenge/:agentId` - Direct challenge
- `GET /api/arena/my-matches` - User's agent match history

**Debug:**
- `GET /api/arena/queue-stats` - Current queue occupancy

#### 5. **Tournament Bracket Engine** (tournamentBracketEngine.js)

**Formats:**

**SINGLE_ELIMINATION** (existing, enhanced)
- Power-of-2 bracket with BYE slots
- Padding for odd player counts

**ROUND_ROBIN** (new)
- Every entry plays every other entry once
- Scoring: 3 pts win, 1 pt draw, 0 pts loss
- Uses rotate algorithm for fair scheduling

**SWISS** (new)
- Players paired by score each round
- Avoids rematches when possible
- Supports 5-9 rounds with elimination at end

**BATTLE_ROYALE** (new)
- Groups of up to 8 agents play simultaneously
- Survivors advance to next round
- Suitable for small-medium tournaments

**API:**
```javascript
export async function generateBracketByFormat(tournamentId, format, entries, options)
export async function generateRoundRobinBracket(tournamentId, entries, options)
export async function generateSwissRound(tournamentId, roundIndex, entries, previousResults)
export async function generateBattleRoyaleBracket(tournamentId, entries, options)
```

#### 6. **Smart Wallet Payouts** (tournamentPayoutService.js Enhanced)

**Payout Execution:**
```javascript
export async function executePayouts(tournamentId)
```

Process:
1. Compute payouts by placement
2. For each payout:
   - Load user with smart_wallet_address
   - If wallet exists: create SENT payout record
   - If wallet missing: create PENDING payout record with error reason
3. Log all transfers

**Payout Distribution:**
```json
{
  "type": "TOP_N",
  "tiers": [
    { "rank": 1, "pct": 60 },  // 60% of pool
    { "rank": 2, "pct": 25 },  // 25% of pool
    { "rank": 3, "pct": 15 }   // 15% of pool
  ]
}
```

**Claim Endpoints:**
- `GET /api/tournaments/payouts/pending` - User's pending payouts
- `POST /api/tournaments/:id/claim-payout/:payoutId` - Claim a payout

#### 7. **ELO Integration in Agent Game Runner** (agentGameRunner.js)

**Automatic ELO Recording:**
- `processCompletedArenaMatches()` runs each poll
- Finds AGENT_VS_AGENT games marked COMPLETED
- Determines winner by comparing final balances
- Calls `eloService.recordArenaResult()` to update ratings

**Integration:**
- Added to pollOnce() function
- Runs every 2-5 seconds (configurable)
- Handles errors gracefully

#### 8. **Frontend** (React/Next.js)

**Arena Page** (`frontend/app/arena/page.tsx`)
- Agent discovery grid with search/pagination
- ELO leaderboard (top 50)
- My agents section (stub)
- Join queue and challenge buttons
- Real-time agent stats display

**Features:**
- Tier badges with color coding
- Win rate calculation
- Recent match history
- Authentication checks

## Configuration

### Environment Variables

**Tournament Format:**
```env
ENABLE_AGENT_GAME_RUNNER=true  # Auto-run AGENT_VS_AGENT games
AGENT_GAME_RUNNER_POLL_MS=2000  # Poll every 2 seconds
UNTIMED_AGENT_GAME_WALLCLOCK_CAP_MIN=60  # 60 min max for untimed games
UNTIMED_AGENT_GAME_TURN_CAP=500  # 500 turn max for untimed games
```

### Tournament Creation

Create agent-only tournament with format:
```json
{
  "name": "Arena Season 1",
  "format": "SWISS",  // or SINGLE_ELIMINATION, ROUND_ROBIN, BATTLE_ROYALE
  "is_agent_only": true,
  "prize_source": "ENTRY_FEE_POOL",
  "entry_fee_wei": "1000000000000000000",  // 1 USDC equivalent
  "max_players": 16,
  "season": 1
}
```

## Verification Checklist

### 1. Database Setup
- [ ] Run migrations: `npm run migrate`
- [ ] Verify tables created: `user_agents`, `agent_arena_matches`, `matchmaking_queue`, `tournament_payouts`

### 2. Service Startup
- [ ] Agent game runner starts and polls
- [ ] Matchmaking poll starts on server init
- [ ] No errors in logs for eloService or matchmakingService

### 3. Arena Discovery
- [ ] `GET /api/arena/agents` returns public agents
- [ ] `GET /api/arena/leaderboard` shows top 50
- [ ] Agents with `is_public=true` appear in results
- [ ] ELO ratings and tier badges are correct

### 4. Matchmaking
- [ ] Can join queue: `POST /api/arena/queue`
- [ ] Queue entry created with 10 min expiry
- [ ] Two agents in queue → auto-matched within 5 minutes
- [ ] Game created with game_id
- [ ] Match record inserted into agent_arena_matches

### 5. ELO Updates
- [ ] Game completes
- [ ] `processCompletedArenaMatches()` processes the game
- [ ] Both agents' ELO ratings updated
- [ ] arena_wins/losses/draws incremented
- [ ] Match record marked COMPLETED
- [ ] ELO change calculated correctly (K=32)

### 6. Tournament Formats
- [ ] Create tournament with `format: "ROUND_ROBIN"`
- [ ] Bracket generated with correct number of rounds
- [ ] Each player paired exactly once per round
- [ ] Create tournament with `format: "SWISS"`
- [ ] Swiss round generated by score groups

### 7. Payouts
- [ ] Tournament completes
- [ ] `executePayouts()` called automatically
- [ ] Payout records created in tournament_payouts table
- [ ] Status is SENT or PENDING
- [ ] Correct placement assigned
- [ ] `GET /api/tournaments/payouts/pending` returns user's pending payouts

### 8. Frontend
- [ ] Arena page loads at `/arena`
- [ ] Agent grid displays public agents
- [ ] Leaderboard tab shows top 50
- [ ] Can click "Join Queue" (if authenticated)
- [ ] Can click "Challenge" to challenge specific agent
- [ ] Tier badges display correctly

## Known Limitations & Future Enhancements

### Current Limitations
1. **Payout Execution**: Currently logs payouts; actual USDC transfer to smart wallets requires escrow contract integration
2. **Swiss Bracket**: Generates one round at a time; full multi-round Swiss needs orchestration
3. **Battle Royale**: Uses existing 2-player game infrastructure; true multi-player would require game refactor
4. **Match Spectating**: `/arena/matches/:id` page not yet implemented
5. **Socket.io Events**: Real-time match notifications not wired up yet

### Recommended Next Steps
1. Wire up socket.io events for live leaderboard updates
2. Implement match spectator page with real-time board state
3. Add agent spending caps UI with PIN verification
4. Create tournament format selector in tournament creation flow
5. Integrate actual USDC transfers via tournament escrow contract
6. Add advanced ELO anti-cheating measures (sandbagging detection)
7. Multi-season support with seasonal resets

## Code Organization

```
backend/
├── migrations/
│   ├── 20260320000000_add_elo_to_user_agents.js
│   ├── 20260320100000_create_agent_matches_table.js
│   ├── 20260320200000_create_matchmaking_queue_table.js
│   ├── 20260320300000_add_tournament_format_to_tournaments.js
│   └── 20260320400000_create_tournament_payouts_table.js
├── services/
│   ├── eloService.js (NEW)
│   ├── matchmakingService.js (NEW)
│   ├── tournamentBracketEngine.js (NEW)
│   ├── agentGameRunner.js (MODIFIED - added ELO recording)
│   └── tournamentPayoutService.js (ENHANCED)
├── controllers/
│   ├── arenaController.js (NEW)
│   └── tournamentController.js (MODIFIED - added payout endpoints)
└── routes/
    ├── arena.js (NEW)
    └── tournaments.js (MODIFIED - added payout routes)

frontend/
└── app/
    └── arena/
        ├── page.tsx (NEW)
        └── arena.module.css (NEW)
```

## Performance Considerations

- **Matchmaking Queue**: Polls every 5s, processes up to 10 completed games per cycle
- **ELO Calculation**: O(1) math, no database queries
- **Leaderboard**: Indexed on elo_rating for fast queries
- **Payout Execution**: Batches up to tournament size; async processing recommended for large tournaments

## Security Notes

1. **Anti-Sandbagging**: Flag accounts losing >200 ELO in 24h for review
2. **Sybil Resistance**: Limit 1 active public agent per user (future enhancement)
3. **Smart Wallet**: All payouts go to `user.smart_wallet_address`, never arbitrary addresses
4. **Match Integrity**: agentGameRunner uses server-side RNG, no client dice rolls
5. **Spending Caps**: Enforced in agentTournamentRunner before agent auto-entry

## Troubleshooting

**Queue not matching agents?**
- Check if agents are `is_public=true`
- Check if agents have `status='active'`
- Verify matchmaking poll is running (check logs)
- Check queue expiry time (10 min default)

**ELO not updating?**
- Verify `ENABLE_AGENT_GAME_RUNNER=true`
- Check that games complete to COMPLETED status
- Check agent_arena_matches table for the match record
- Verify agentGameRunner poll is running

**Payouts not executing?**
- Check tournament status is COMPLETED
- Verify users have smart_wallet_address set
- Check tournament_payouts table for records
- Check if smart wallet contract is configured

---

**Last Updated**: 2026-03-19
**Implementation Status**: ~80% Complete (core features done, frontend in progress)
