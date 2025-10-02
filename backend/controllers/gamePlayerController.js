import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameSetting from "../models/GameSetting.js";
import User from "../models/User.js";

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
      const { user_id, game_id, position } = req.body;
      const game = await Game.findById(game_id);
      if (!game) {
        res.json({ error: "Game not found" });
      }
      const game_player = await GamePlayer.findByUserIdAndGameId(
        user_id,
        game_id
      );
      if (!game_player) {
        res.json({ error: "Game player not found" });
      }
      const update_game_player = await GamePlayer.update(game_player.id, {
        position,
      });
      res.json(update_game_player);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async endTurn(req, res) {
    try {
      const { user_id, game_id } = req.body;

      // Find the game
      const game = await Game.findById(game_id);
      if (!game) {
        return res.status(400).json({ error: "Game not found" });
      }

      // Verify the current player exists
      const current_player = await GamePlayer.findByUserIdAndGameId(
        user_id,
        game_id
      );
      if (!current_player) {
        return res.status(400).json({ error: "Game player not found" });
      }

      // if (current_player.id !== game.next_player_id) {
      //   return res.status(400).json({ error: "It is not your turn" });
      // }

      // Get all players in the game ordered by turn_order
      const all_players = await GamePlayer.findByGameId(game_id);

      if (!all_players || all_players.length === 0) {
        return res.status(400).json({ error: "No players found in game" });
      }

      // Sort players by turn_order to maintain clockwise rotation
      const sorted_players = all_players.sort(
        (a, b) => a.turn_order - b.turn_order
      );

      // Find current player's index
      const current_player_index = sorted_players.findIndex(
        (player) => player.user_id === user_id
      );

      if (current_player_index === -1) {
        return res
          .status(400)
          .json({ error: "Current player not found in player list" });
      }

      // Calculate next player index (clockwise rotation)
      let next_player_index;
      if (current_player_index === sorted_players.length - 1) {
        // If current player is last, wrap around to first player
        next_player_index = 0;
      } else {
        // Otherwise, move to next player
        next_player_index = current_player_index + 1;
      }

      const next_player = sorted_players[next_player_index];

      if (!next_player) {
        return res.status(400).json({ error: "Next player not found" });
      }

      // Update game with next player
      const update_game = await Game.update(game.id, {
        next_player_id: next_player.user_id,
      });

      res.json(update_game);
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
