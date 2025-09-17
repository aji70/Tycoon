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
      res.status(201).json(player);
    } catch (error) {
      console.error("Error creating game player:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const player = await GamePlayer.findById(req.params.id);
      if (!player)
        return res.status(404).json({ error: "Game player not found" });
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
