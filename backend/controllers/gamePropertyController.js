import db from "../config/database.js";
import GameProperty from "../models/GameProperty.js";
import { transferPropertyOwnership, isContractConfigured } from "../services/tycoonContract.js";
import {
  recordPropertyPurchase,
  incrementPropertiesSold,
} from "../utils/userPropertyStats.js";
import logger from "../config/logger.js";

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
        return res.status(404).json({ error: "Game property not found" });
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
      const { game_id, player_id: newPlayerId } = req.body;
      const idParam = req.params.id;

      // Resolve the game_property row: frontend may send game_properties.id (gp.id) or property_id (board 1–40) with game_id
      let current = null;
      if (game_id && idParam) {
        const byGameAndProperty = await db("game_properties as gp")
          .join("game_players as p", "gp.player_id", "p.id")
          .join("users as u", "p.user_id", "u.id")
          .where("gp.game_id", game_id)
          .where("gp.property_id", idParam)
          .select("gp.id", "gp.player_id", "gp.property_id", "u.id as seller_user_id", "u.username as seller_username")
          .first();
        if (byGameAndProperty) current = { id: byGameAndProperty.id, player_id: byGameAndProperty.player_id, property_id: byGameAndProperty.property_id, seller_user_id: byGameAndProperty.seller_user_id, seller_username: byGameAndProperty.seller_username };
      }
      if (!current) {
        const byId = await db("game_properties as gp")
          .join("game_players as p", "gp.player_id", "p.id")
          .join("users as u", "p.user_id", "u.id")
          .where("gp.id", idParam)
          .select("gp.id", "gp.player_id", "gp.property_id", "u.id as seller_user_id", "u.username as seller_username")
          .first();
        if (byId) current = { id: byId.id, player_id: byId.player_id, property_id: byId.property_id, seller_user_id: byId.seller_user_id, seller_username: byId.seller_username };
      }

      const isTransfer = current && newPlayerId != null && Number(current.player_id) !== Number(newPlayerId);
      let sellerUsername = current?.seller_username ?? null;
      let buyerUsername = null;
      let buyerUserId = null;
      if (isTransfer && newPlayerId) {
        const buyer = await db("game_players as p")
          .join("users as u", "p.user_id", "u.id")
          .where("p.id", newPlayerId)
          .select("u.id as user_id", "u.username")
          .first();
        buyerUsername = buyer?.username ?? null;
        buyerUserId = buyer?.user_id ?? null;
      }

      const updateId = current ? current.id : idParam;
      const property = await GameProperty.update(updateId, req.body);
      res.json({ success: true, message: "successful", data: property });

      // On-chain: update stats when ownership transferred (P2P sale)
      const contractConfigured = isContractConfigured();
      logger.info({
        idParam,
        game_id,
        newPlayerId,
        currentFound: !!current,
        currentPlayerId: current?.player_id,
        isTransfer,
        sellerUsername,
        buyerUsername,
        contractConfigured,
      }, "game_properties/update: transfer and contract check");

      if (isTransfer && sellerUsername && buyerUsername && contractConfigured) {
        logger.info({ sellerUsername, buyerUsername }, "Calling transferPropertyOwnership(seller, buyer)");
        transferPropertyOwnership(sellerUsername, buyerUsername).catch((err) => {
          logger.warn({ err, sellerUsername, buyerUsername }, "Tycoon transferPropertyOwnership failed");
        });
      }
      if (isTransfer && !contractConfigured) {
        logger.warn("Skipping transferPropertyOwnership: contract not configured (set CELO_RPC_URL, TYCOON_CELO_CONTRACT_ADDRESS, BACKEND_GAME_CONTROLLER_PRIVATE_KEY)");
      } else if (isTransfer && (!sellerUsername || !buyerUsername)) {
        logger.warn({ sellerUsername, buyerUsername }, "Skipping transferPropertyOwnership: missing seller or buyer username");
      }
      if (isTransfer && current?.seller_user_id && buyerUserId && current?.property_id && game_id) {
        incrementPropertiesSold(current.seller_user_id).catch(() => {});
        recordPropertyPurchase(buyerUserId, current.property_id, game_id, "trade").catch(() => {});
      }
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

      // Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        return res.status(404).json({ error: "Game not found" });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        return res.status(422).json({ error: "Game is currently not running" });
      }

      //  Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        return res.status(404).json({ error: "Player not in game" });
      }

      //  Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property) {
        await trx.rollback();
        return res.status(404).json({ error: "Property not found" });
      }

      //  Check if property already owned by someone in this game
      const existing = await trx("game_properties")
        .where({ property_id, game_id })
        .first();
      if (existing) {
        await trx.rollback();
        return res
          .status(422)
          .json({ error: "Game property not available for purchase" });
      }

      // Check player balance
      if (Number(player.balance) < Number(property.price)) {
        await trx.rollback();
        return res.status(422).json({ error: "Insufficient balance" });
      }

      //  Deduct balance
      await trx("game_players")
        .where({ id: player.id })
        .update({
          balance: Number(player.balance) - Number(property.price),
          updated_at: db.fn.now(),
        });

      //  Assign property to player
      await trx("game_properties").insert({
        game_id: game.id,
        property_id: property.id,
        player_id: player.id,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      await trx.commit();

      // Stats: record property purchase (bank)
      recordPropertyPurchase(user_id, property_id, game.id, "bank").catch(() => {});

      // On-chain: call transferPropertyOwnership using env (seller=Bank, buyer=player). Contract must have "Bank" registered for this to succeed.
      if (isContractConfigured()) {
        const buyerUsername = (await db("users").where({ id: player.user_id }).select("username").first())?.username ?? null;
        if (buyerUsername) {
          transferPropertyOwnership("Bank", buyerUsername).catch((err) => {
            logger.warn({ err, buyerUsername }, "Tycoon transferPropertyOwnership failed (buy from bank)");
          });
        }
      }

      return res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async development(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Game not found", data: null });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game is currently not running",
          data: null,
        });
      }

      //  Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Player not in game", data: null });
      }
      if (player.in_jail) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Cannot develop property from jail",
          data: null,
        });
      }

      //  Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Property not found", data: null });
      }

      if (property.group_id == "0") {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Property can not be developed",
          data: null,
        });
      }

      //  Check if property is owned by user
      const game_property = await trx("game_properties")
        .where({ property_id, game_id, player_id: player.id })
        .first();
      if (!game_property) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game property not available for development",
          data: null,
        });
      }
      if (game_property.mortgaged) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Cannot develop a mortgaged property",
          data: null,
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
        return res.status(422).json({
          success: false,
          message: "You must own all properties in this group to develop",
          data: null,
        });
      }

      // Get current development levels for all properties in the group
      const groupDevelopments = await trx("game_properties")
        .whereIn("property_id", groupProperties)
        .andWhere({ game_id, player_id: player.id })
        .select("property_id", "development"); // assumes this column exists

      if (groupDevelopments.length > 0) {
        const levels = groupDevelopments.map((p) => Number(p.development || 0));
        const minLevel = Math.min(...levels);
        const maxLevel = Math.max(...levels);

        // No property may have a difference greater than 1
        if (maxLevel - minLevel > 1) {
          await trx.rollback();
          return res.status(422).json({
            success: false,
            message:
              "Development levels in this property group must be within 1 level of each other.",
            data: null,
          });
        }

        // The property being upgraded cannot exceed the lowest by more than 1
        const currentPropertyLevel = Number(game_property.development || 0);
        const proposedLevel = currentPropertyLevel + 1;

        if (proposedLevel - minLevel > 1) {
          await trx.rollback();
          return res.status(422).json({
            success: false,
            message:
              "You must build evenly across all properties in this group (cannot upgrade this one yet).",
            data: null,
          });
        }
      }

      // Check player balance
      if (Number(player.balance) < Number(property.cost_of_house)) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Insufficient balance",
          data: null,
        });
      }

      if (game_property.development >= 5) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Property developed to the max",
          data: null,
        });
      }

      //  Deduct balance
      await trx("game_players")
        .where({ id: player.id })
        .update({
          balance: Number(player.balance) - Number(property.cost_of_house),
          updated_at: db.fn.now(),
        });

      //  Update game property development
      await trx("game_properties")
        .where({ id: game_property.id })
        .increment("development", 1);

      await trx.commit();
      return res
        .status(200)
        .json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async downgrade(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Game not found", data: null });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game is currently not running",
          data: null,
        });
      }

      //  Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Player not in game", data: null });
      }

      if (player.in_jail) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Cannot downgrade property from jail",
          data: null,
        });
      }
      //  Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Property not found", data: null });
      }

      if (property.group_id == "0") {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Property can not be downgraded",
          data: null,
        });
      }

      //  Check if property is owned by user
      const game_property = await trx("game_properties")
        .where({ property_id, game_id, player_id: player.id })
        .first();
      if (!game_property) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game property not available for downgrade",
          data: null,
        });
      }

      if (game_property.mortgaged) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Cannot downgrade a mortgaged property",
          data: null,
        });
      }

      // No development
      if (game_property.development <= 0) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "No active development on this property",
          data: null,
        });
      }

      // Credit balance
      await trx("game_players")
        .where({ id: player.id })
        .increment("balance", Number(property.cost_of_house) / 2);

      // Update game property development
      await trx("game_properties")
        .where({ id: game_property.id })
        .decrement("development", 1);

      await trx.commit();
      return res
        .status(200)
        .json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async mortgage(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Game not found", data: null });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game is currently not running",
          data: null,
        });
      }

      //  Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Player not in game", data: null });
      }

      if (player.in_jail) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Cannot mortgage property from jail",
          data: null,
        });
      }

      //  Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property || property.price <= 0) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Property not found", data: null });
      }

      //  Check if property is owned by user
      const game_property = await trx("game_properties")
        .where({ property_id, game_id, player_id: player.id })
        .first();
      if (!game_property) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game property not available",
          data: null,
        });
      }

      if (game_property.mortgaged) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Property is already mortgaged ",
          data: null,
        });
      }

      if (game_property.development > 0) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Property is developed, downgrade back to land to mortgage",
          data: null,
        });
      }

      //  Credit balance
      await trx("game_players")
        .where({ id: player.id })
        .increment("balance", Number(property.price) / 2);

      //  Update game property mortgaged
      await trx("game_properties")
        .where({ id: game_property.id })
        .update({ mortgaged: 1 });

      await trx.commit();
      return res
        .status(200)
        .json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async unmortgage(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Game not found", data: null });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game is currently not running",
          data: null,
        });
      }

      //  Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Player not in game", data: null });
      }

      if (player.in_jail) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Cannot unmortgage property from jail",
          data: null,
        });
      }

      //  Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property || property.price <= 0) {
        await trx.rollback();
        return res
          .status(422)
          .json({ success: false, message: "Property not found", data: null });
      }

      //  Check if property is owned by user
      const game_property = await trx("game_properties")
        .where({ property_id, game_id, player_id: player.id })
        .first();
      if (!game_property) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Game property not available",
          data: null,
        });
      }

      if (!game_property.mortgaged) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Property is not mortgaged ",
          data: null,
        });
      }

      // Check player balance
      if (Number(player.balance) < Number(property.price)) {
        await trx.rollback();
        return res.status(422).json({
          success: false,
          message: "Insufficient balance",
          data: null,
        });
      }

      //  Debit balance
      await trx("game_players")
        .where({ id: player.id })
        .decrement("balance", Number(property.price));

      //  Update game property mortgaged
      await trx("game_properties")
        .where({ id: game_property.id })
        .update({ mortgaged: 0 });

      await trx.commit();
      return res
        .status(200)
        .json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },
};

export default gamePropertyController;
