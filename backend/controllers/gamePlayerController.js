import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import GameSetting from "../models/GameSetting.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { PROPERTY_ACTION } from "../utils/properties.js";

const gamePlayerController = {
  async create(req, res) {
    try {
      const { address, code } = req.body;
      const user = await User.findByAddress(address);
      if (!user) {
        res.status(422).json({ success: false, message: "User not found" });
      }
      const game = await Game.findByCode(code);
      if (!game) {
        res.status(422).json({ success: false, message: "Game not found" });
      }
      const settings = await GameSetting.findByGameId(game.id);
      if (!settings) {
        res
          .status(422)
          .json({ success: false, message: "Game settings not found" });
      }
      const players = await GamePlayer.findByGameId(game.id);
      if (!players) {
        res
          .status(422)
          .json({ success: false, message: "Game players not found" });
      }
      const player = await GamePlayer.create({
        ...req.body,
        user_id: user.id,
        balance: settings.starting_cash,
        position: 0,
        chance_jail_card: 0,
        community_chest_jail_card: 0,
        // turn_order: req.body.turn_order ?? players.length + 1,
      });
      res
        .status(201)
        .json({ success: true, message: "Player added to game successfully" });
    } catch (error) {
      console.error("Error creating game player:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },
  async join(req, res) {
    try {
      const { address, code, symbol } = req.body;

      // find user
      const user = await User.findByAddress(address);
      if (!user) {
        return res
          .status(422)
          .json({ success: false, message: "User not found" });
      }

      // find game
      const game = await Game.findByCode(code);
      if (!game) {
        return res
          .status(422)
          .json({ success: false, message: "Game not found" });
      }

      // find settings
      const settings = await GameSetting.findByGameId(game.id);
      if (!settings) {
        return res
          .status(422)
          .json({ success: false, message: "Game settings not found" });
      }

      // fetch players in game
      const players = await GamePlayer.findByGameId(game.id);
      if (!players) {
        return res
          .status(422)
          .json({ success: false, message: "Game players not found" });
      }

      // find max turn order (0 if no players yet)
      const maxTurnOrder =
        players.length > 0
          ? Math.max(...players.map((p) => p.turn_order || 0))
          : 0;

      // assign next turn_order
      const nextTurnOrder = maxTurnOrder + 1;

      // create new player
      const player = await GamePlayer.create({
        address,
        symbol,
        user_id: user.id,
        game_id: game.id,
        balance: settings.starting_cash,
        position: 0,
        chance_jail_card: false,
        community_chest_jail_card: false,
        turn_order: nextTurnOrder,
      });

      return res.status(201).json({
        success: true,
        message: "Player added to game successfully",
        data: player,
      });
    } catch (error) {
      console.error("Error creating game player:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },
  async leave(req, res) {
    try {
      const { address, code } = req.body;
      const user = await User.findByAddress(address);
      if (!user) {
        res.status(422).json({ success: false, message: "User not found" });
      }
      const game = await Game.findByCode(code);
      if (!game) {
        res.status(422).json({ success: false, message: "Game not found" });
      }
      const player = await GamePlayer.leave(game.id, user.id);
      res.status(200).json({
        success: true,
        message: "Player removed to game successfully",
      });
    } catch (error) {
      console.error("Error creating game player:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },
  async findById(req, res) {
    try {
      const player = await GamePlayer.findById(req.params.id);
      if (!player)
        return res.status(400).json({ error: "Game player not found" });
      res.json(player);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const players = await GamePlayer.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async findByGame(req, res) {
    try {
      const players = await GamePlayer.findByGameId(req.params.gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async findByUser(req, res) {
    try {
      const players = await GamePlayer.findByUserId(req.params.userId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async update(req, res) {
    try {
      const player = await GamePlayer.update(req.params.id, req.body);
      res.json(player);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async changePosition(req, res) {
    try {
      const { user_id, game_id, position, rolled = null } = req.body;

      // 1) Validate game
      const game = await Game.findById(game_id);
      if (!game) return res.status(404).json({ error: "Game not found" });

      // 2) Ensure it's this player's turn (important for one-roll-round)
      if (game.next_player_id !== user_id) {
        return res.status(403).json({ error: "It is not your turn." });
      }

      // 3) Validate user
      const user = await User.findById(user_id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // 4) Validate property/position
      const property = await Property.findById(position);
      if (!property)
        return res.status(404).json({ error: "Property not found" });

      // 5) Validate game player entry
      const game_player = await GamePlayer.findByUserIdAndGameId(
        user_id,
        game_id
      );
      if (!game_player)
        return res.status(404).json({ error: "Game player not found" });

      // 6) Prevent duplicate rolls within same round
      //    (one roll per player per round). If you later add doubles/extras, adapt this check.
      const currentRolls = Number(game_player.rolls || 0);
      if (currentRolls >= 1) {
        return res
          .status(400)
          .json({
            error: "You already rolled this round. Wait for others to roll.",
          });
      }

      // 7) compute old/new positions and payload to update
      const old_position = Number(game_player.position || 0);
      const new_position = Number(position);
      const actionType = PROPERTY_ACTION(new_position);
      const passedStart = new_position < old_position;

      const updatedFields = {
        position: new_position,
        rolls: currentRolls + 1,
      };

      if (passedStart) {
        updatedFields.circle = Number(game_player.circle || 0) + 1;
        updatedFields.balance = Number(game_player.balance || 0) + 200; // pass start bonus
      }

      // OPTIONAL: wrap these DB operations in a transaction if your ORM supports it.
      const updated_player = await GamePlayer.update(
        game_player.id,
        updatedFields
      );

      // 8) Log the move (active = 1 is acceptable — endTurn will mark it inactive)
      await GamePlayHistory.create({
        game_id,
        game_player_id: game_player.id,
        rolled,
        old_position,
        new_position,
        action: actionType,
        amount: 0,
        extra: JSON.stringify({
          description: `${user.username} moved from ${old_position} → ${new_position}`,
        }),
        comment: `${user.username} moved to ${property.name}`,
        active: 1, // mark this history as the current active play
      });

      // 9) Return updated player (and optionally fresh game state if you want)
      const freshGame = await Game.findById(game_id);
      res.json({
        success: true,
        message: `${user.username} position updated and logged successfully.`,
        player: updated_player,
        game: freshGame,
      });
    } catch (error) {
      console.error("Error changing position:", error);
      res.status(500).json({ error: error.message });
    }
  },
  async endTurn(req, res) {
    try {
      const { user_id, game_id } = req.body;

      // 1) Validate game
      const game = await Game.findById(game_id);
      if (!game) return res.status(400).json({ error: "Game not found" });

      // 2) Validate player
      const current_player = await GamePlayer.findByUserIdAndGameId(
        user_id,
        game_id
      );
      if (!current_player)
        return res.status(400).json({ error: "Game player not found" });

      // 2b) Ensure only the player whose turn it is can end the turn
      if (game.next_player_id !== user_id) {
        return res
          .status(403)
          .json({ error: "You cannot end another player's turn." });
      }

      // 3) Load all players ordered by turn_order
      const all_players = await GamePlayer.findByGameId(game_id);
      if (!all_players?.length)
        return res.status(400).json({ error: "No players found in game" });

      const sorted_players = all_players.sort(
        (a, b) => a.turn_order - b.turn_order
      );
      const current_player_index = sorted_players.findIndex(
        (p) => p.user_id === user_id
      );

      if (current_player_index === -1) {
        return res
          .status(400)
          .json({ error: "Current player not found in list" });
      }

      // 4) Determine next player (wrap)
      const next_player_index =
        current_player_index === sorted_players.length - 1
          ? 0
          : current_player_index + 1;
      const next_player = sorted_players[next_player_index];
      if (!next_player)
        return res.status(400).json({ error: "Next player not found" });

      // 5) Mark last active history as inactive
      const last_active = await GamePlayHistory.findLatestActiveByGameId(
        game_id
      );
      if (last_active) {
        await GamePlayHistory.update(last_active.id, { active: 0 });
      }

      // 6) Update game next_player_id
      const updated_game = await Game.update(game.id, {
        next_player_id: next_player.user_id,
      });

      // 7) Check if a full round has completed (everyone has rolled at least once)
      //    If yes, reset rolls for all players so the new round can begin.
      //    Note: we re-fetch players to get the most recent rolls values (including the roll we just recorded).
      const latest_players = await GamePlayer.findByGameId(game_id);
      const allHaveRolled = latest_players.every(
        (p) => Number(p.rolls || 0) >= 1
      );

      if (allHaveRolled) {
        // Reset rolls for the next round
        await Promise.all(
          latest_players.map((p) => GamePlayer.update(p.id, { rolls: 0 }))
        );

        // Optional: create a round boundary history record
        await GamePlayHistory.create({
          game_id,
          game_player_id: current_player.id,
          rolled: null,
          old_position: null,
          new_position: null,
          action: "ROUND_COMPLETE",
          amount: 0,
          extra: JSON.stringify({
            description:
              "All players rolled — starting new round (rolls reset).",
          }),
          comment: "Round completed. Rolls reset.",
          active: 0,
        });
      }

      res.json({
        success: true,
        message: "Turn ended successfully. Next player updated.",
        next_player: next_player.user_id,
        game: updated_game,
      });
    } catch (error) {
      console.error("Error ending turn:", error);
      res.status(400).json({ error: error.message });
    }
  },
  async remove(req, res) {
    try {
      await GamePlayer.delete(req.params.id);
      res.json({ message: "Game player removed" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default gamePlayerController;
