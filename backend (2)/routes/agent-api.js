/**
 * Read-only API for agents (discoverability, skill, open games, game state).
 * Used for Celo hackathon / agent skills — no auth required for read endpoints.
 */

import express from "express";
import Game from "../models/Game.js";
import GameSetting from "../models/GameSetting.js";
import GamePlayer from "../models/GamePlayer.js";

const router = express.Router();

/**
 * GET /api/agent-api/skill
 * Returns Tycoon agent skill description (markdown) for discoverability.
 * Agents can use this to learn how to interact with Tycoon (create game, join, get state, submit move).
 */
router.get("/skill", (_req, res) => {
  const baseUrl =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://tycoonworld.xyz";
  const apiBase = `${baseUrl.replace(/\/$/, "")}/api`;
  const markdown = `# Tycoon Agent Skill

Tycoon is a Monopoly-style blockchain game. Agents can create games, join games, read game state, and submit moves.

## Endpoints (read-only for discovery)

- **List open games (lobbies):** \`GET ${apiBase}/agent-api/games/open\`
- **Get game state:** \`GET ${apiBase}/agent-api/games/:id/state\`

## Playing as an agent

1. **Register your agent** in Tycoon (My Agents): add a callback URL that exposes \`POST /decision\` with request/response shape per Tycoon Celo Agent spec.
2. **Create or join a game** via the Tycoon frontend or (when available) API.
3. **Use "My agent plays for me"** so your endpoint receives decision requests (property buy/skip, trade accept/decline, build, strategy).
4. **ERC-8004:** Register your agent on Celo for identity and reputation (see Tycoon docs).

## Decision request shape (Tycoon → your agent)

\`POST <your-url>/decision\`

\`\`\`json
{
  "requestId": "req_...",
  "gameId": 123,
  "slot": 1,
  "decisionType": "property" | "trade" | "building" | "strategy",
  "context": { "myBalance", "myProperties", "opponents", "landedProperty", "tradeOffer", ... },
  "deadline": "ISO date"
}
\`\`\`

Response: \`{ "requestId", "action": "buy"|"skip"|"accept"|"decline"|"build"|"wait", "propertyId?", "reasoning?", "confidence?" }\`

## Links

- [Tycoon](https://tycoonworld.xyz)
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
`;
  res.set("Content-Type", "text/markdown; charset=utf-8");
  res.send(markdown);
});

/**
 * GET /api/agent-api/games/open
 * List open (PENDING, joinable) games. Same data as GET /games/open, agent-friendly path.
 */
router.get("/games/open", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const games = await Game.findOpenGames({
      limit: Math.min(Number(limit) || 20, 100),
      offset: Number(offset) || 0,
    });
    const withSettingsAndPlayers = await Promise.all(
      games.map(async (g) => ({
        id: g.id,
        code: g.code,
        status: g.status,
        is_ai: g.is_ai,
        number_of_players: g.number_of_players,
        created_at: g.created_at,
        settings: await GameSetting.findByGameId(g.id),
        players: await GamePlayer.findByGameId(g.id),
      }))
    );
    res.json({ success: true, data: withSettingsAndPlayers });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Failed to list open games" });
  }
});

/**
 * GET /api/agent-api/games/:id/state
 * Public read-only game state for agents (no auth). Returns game + settings + players.
 */
router.get("/games/:id/state", async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    const settings = await GameSetting.findByGameId(game.id);
    const players = await GamePlayer.findByGameId(game.id);
    res.json({
      success: true,
      data: {
        id: game.id,
        code: game.code,
        status: game.status,
        is_ai: game.is_ai,
        number_of_players: game.number_of_players,
        next_player_id: game.next_player_id,
        winner_id: game.winner_id,
        started_at: game.started_at,
        created_at: game.created_at,
        settings,
        players: (players || []).map((p) => ({
          id: p.id,
          user_id: p.user_id,
          username: p.username,
          balance: p.balance,
          position: p.position,
          turn_order: p.turn_order,
          symbol: p.symbol,
          in_jail: p.in_jail,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Failed to get game state" });
  }
});

export default router;
