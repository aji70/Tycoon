import db from "../config/database.js";
import GameProperty from "../models/GameProperty.js";

const gamePropertyController = {
  async create(req, res) {
    try {
      const property = await GameProperty.create(req.body);
      res
        .status(201)
        .json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const property = await GameProperty.findById(req.params.id);
      if (!property)
        res.status(404).json({ error: "Game property not found" });
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const properties = await GameProperty.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByGame(req, res) {
    try {
      const properties = await GameProperty.findByGameId(req.params.gameId);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByPlayer(req, res) {
    try {
      const properties = await GameProperty.findByPlayerId(req.params.playerId);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const property = await GameProperty.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await GameProperty.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async buy(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // 1️⃣ Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        res.status(404).json({ error: "Game not found" });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        res.status(422).json({ error: "Game is currently not running" });
      }

      // 2️⃣ Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        res.status(404).json({ error: "Player not in game" });
      }

      // 3️⃣ Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property) {
        await trx.rollback();
        res.status(404).json({ error: "Property not found" });
      }

      // 4️⃣ Check if property already owned by someone in this game
      const existing = await trx("game_properties")
        .where({ property_id, game_id })
        .first();
      if (existing) {
        await trx.rollback();
        res
          .status(422)
          .json({ error: "Game property not available for purchase" });
      }

      // 5️⃣ Check player balance
      if (Number(player.balance) < Number(property.price)) {
        await trx.rollback();
        res.status(422).json({ error: "Insufficient balance" });
      }

      // 6️⃣ Deduct balance
      await trx("game_players")
        .where({ id: player.id })
        .update({
          balance: Number(player.balance) - Number(property.price),
          updated_at: db.fn.now(),
        });

      // 7️⃣ Assign property to player
      await trx("game_properties").insert({
        game_id: game.id,
        property_id: property.id,
        player_id: player.id,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      await trx.commit();
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async development(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // 1️⃣ Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        res
          .status(200)
          .json({ success: false, data: null, message: "Game not found" });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        res
          .status(200)
          .json({
            success: false,
            data: null,
            message: "Game is currently not running",
          });
      }

      // 2️⃣ Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        res
          .status(200)
          .json({ success: false, data: null, message: "Player not in game" });
      }

      // 3️⃣ Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property) {
        await trx.rollback();
        res
          .status(200)
          .json({ success: false, data: null, message: "Property not found" });
      }

      if (property.group_id == "0") {
        await trx.rollback();
        res
          .status(200)
          .json({
            success: false,
            data: null,
            message: "Property can not be developed",
          });
      }

      // 4️⃣ Check if property is owned by user
      const game_property = await trx("game_properties")
        .where({ property_id, game_id, player_id: player.id })
        .first();
      if (!game_property) {
        await trx.rollback();
        res
          .status(200)
          .json({
            success: false,
            data: null,
            message: "Game property not available for development",
          });
      }

      // Get all property IDs in that group
      const groupProperties = await trx("properties")
        .where("group_id", property.group_id)
        .pluck("id");

      // Check which of those properties the user owns in this game
      const ownedGroupProps = await trx("game_properties")
        .whereIn("property_id", groupProperties)
        .andWhere({ game_id, player_id: player.id }) // adjust to your owner field
        .count("id as count")
        .first();

      // Compare counts
      if (Number(ownedGroupProps.count) !== groupProperties.length) {
        await trx.rollback();
        res.status(200).json({
          success: false,
          data: null,
          message: "You must own all properties in this group to develop",
        });
      }

      // 5️⃣ Check player balance
      if (Number(player.balance) < Number(property.cost_of_house)) {
        await trx.rollback();
        res
          .status(200)
          .json({
            success: false,
            data: null,
            message: "Insufficient balance",
          });
      }

      if (game_property.development >= 5) {
        await trx.rollback();
        res
          .status(200)
          .json({
            success: false,
            data: null,
            message: "Property developed to the max",
          });
      }

      // 6️⃣ Deduct balance
      await trx("game_players")
        .where({ id: player.id })
        .update({
          balance: Number(player.balance) - Number(property.cost_of_house),
          updated_at: db.fn.now(),
        });

      // 7️⃣ Update game property development
      await trx("game_properties").update(game_property.id, {
        development: game_property.development + 1,
      });

      await trx.commit();
      res
        .status(200)
        .json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },
};

export default gamePropertyController;
