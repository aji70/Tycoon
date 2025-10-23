import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import GameSetting from "../models/GameSetting.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { PROPERTY_ACTION } from "../utils/properties.js";
import db from "../config/database.js";

const payRent = async (
  { game_id, property_id, player_id, old_position, new_position, rolled },
  trx
) => {
  try {
    const now = new Date();

    // Constants
    const RAILWAY_IDS = [5, 15, 25, 35];
    const UTILITY_IDS = [12, 28];
    const CHANCE_IDS = [7, 22, 36];
    const COMMUNITY_CHEST_IDS = [2, 17, 33];

    // Fetch all required data in parallel
    const [property, game, game_settings, game_player, player] =
      await Promise.all([
        trx("properties").where({ id: property_id }).first(),
        trx("games").where({ id: game_id }).forUpdate().first(),
        trx("game_settings").where({ game_id }).forUpdate().first(),
        trx("game_players").where({ id: player_id }).forUpdate().first(),
        // Fetch player user info early
        trx("game_players")
          .where({ id: player_id })
          .first()
          .then((gp) =>
            gp ? trx("users").where({ id: gp.user_id }).first() : null
          ),
      ]);

    // Validate fetched data
    if (!property || !game || game.status !== "RUNNING" || !game_settings) {
      return { success: false, message: "Invalid game state" };
    }

    if (!game_player || game_player.game_id !== game.id || !player) {
      return { success: false, message: "Invalid player" };
    }

    // Get game property
    const game_property = await trx("game_properties")
      .forUpdate()
      .where({
        property_id: property.id,
        game_id: game.id,
      })
      .first();

    // No rent if property unowned, owned by current player, or mortgaged
    if (
      !game_property ||
      game_property.player_id === game_player.id ||
      game_property.mortgaged
    ) {
      return {
        success: true,
        message: "No rent required",
        position: new_position,
      };
    }

    const property_owner_id = game_property.player_id;

    // Get property owner and their user info in parallel
    const [property_owner, owner] = await Promise.all([
      trx("game_players").where({ id: property_owner_id }).forUpdate().first(),
      trx("game_players")
        .where({ id: property_owner_id })
        .first()
        .then((po) =>
          po ? trx("users").where({ id: po.user_id }).first() : null
        ),
    ]);

    if (!property_owner || !owner) {
      return { success: false, message: "Property owner not found" };
    }

    let rent = null;
    let position = new_position;
    let comment = "";
    let chanceCard = null;

    // Get other players count (cached for per_player calculations)
    const get_players_count = await trx("game_players")
      .where("game_id", game.id)
      .where("id", "!=", game_player.id)
      .count({ cnt: "*" })
      .first();
    const players_count = Number(get_players_count?.cnt || 0);

    // Calculate rent based on property type
    if (RAILWAY_IDS.includes(property.id)) {
      const ownedCountResult = await trx("game_properties")
        .where({
          game_id: game.id,
          player_id: property_owner_id,
        })
        .whereIn("property_id", RAILWAY_IDS)
        .count({ cnt: "*" })
        .first();

      const owned = Number(ownedCountResult?.cnt || 0);
      const rentAmounts = { 1: 25, 2: 50, 3: 100, 4: 200 };
      const rentAmount = rentAmounts[owned] || 0;
      rent = { player: -rentAmount, owner: rentAmount, players: 0 };
      comment = `${player.username} paid ${rentAmount} to ${
        owner.username
      } for ${owned} railway${owned > 1 ? "s" : ""}`;
    } else if (UTILITY_IDS.includes(property.id)) {
      const ownedCountResult = await trx("game_properties")
        .where({
          game_id: game.id,
          player_id: property_owner_id,
        })
        .whereIn("property_id", UTILITY_IDS)
        .count({ cnt: "*" })
        .first();

      const owned = Number(ownedCountResult?.cnt || 0);
      const multiplier = owned === 1 ? 4 : owned === 2 ? 10 : 0;
      const rentAmount = Number(rolled || 0) * multiplier;
      rent = { player: -rentAmount, owner: rentAmount, players: 0 };
      comment = `${player.username} paid ${rentAmount} to ${
        owner.username
      } for ${owned} utility${owned > 1 ? "ies" : "y"}`;
    } else if (CHANCE_IDS.includes(property.id)) {
      const chance = await trx("chances").orderByRaw("RAND()").first();

      if (chance) {
        chanceCard = chance;
        const extra = chance.extra ? JSON.parse(chance.extra) : {};
        const chanceType = chance.type.trim().toLowerCase();

        switch (chanceType) {
          case "credit_and_move":
            rent = { player: chance.amount, owner: 0, players: 0 };
            position = chance.position;
            break;
          case "debit_and_move":
            rent = { player: -chance.amount, owner: 0, players: 0 };
            position = chance.position;
            break;
          case "move":
            position =
              chance.position >= 0
                ? chance.position
                : (new_position + chance.position + 40) % 40;
            break;
          case "credit":
            rent = { player: chance.amount, owner: 0, players: 0 };
            break;
          case "debit":
            rent = { player: -chance.amount, owner: 0, players: 0 };
            break;
        }

        // Handle extra rule logic
        if (extra?.rule) {
          const rule = extra.rule;

          if (rule === "nearest_utility") {
            position =
              UTILITY_IDS.find((id) => id > new_position) ?? UTILITY_IDS[0];
          } else if (rule === "nearest_railroad") {
            position =
              RAILWAY_IDS.find((id) => id > new_position) ?? RAILWAY_IDS[0];
          } else if (rule === "get_out_of_jail_free") {
            await trx("game_players")
              .where({ id: game_player.id })
              .update({ chance_jail_card: 1 });
          } else if (rule === "go_to_jail") {
            position = 10;
            await trx("game_players").where({ id: game_player.id }).update({
              in_jail: true,
              in_jail_rolls: 0,
              position: 10,
              updated_at: now,
            });

            // Deduct GO money if passed start
            rent =
              old_position > new_position
                ? { player: -200, owner: 0, players: 0 }
                : { player: 0, owner: 0, players: 0 };
          } else if (rule === "per_player") {
            const totalAmount = -chance.amount * players_count;
            rent = {
              player: totalAmount,
              owner: 0,
              players: chance.amount,
            };
          }
        }
        comment = `${player.username} drew chance: ${chance.instruction}`;
      }
    } else if (COMMUNITY_CHEST_IDS.includes(property.id)) {
      const communityChest = await trx("community_chests")
        .orderByRaw("RAND()")
        .first();

      if (communityChest) {
        chanceCard = communityChest;
        const extra = communityChest.extra
          ? JSON.parse(communityChest.extra)
          : {};
        const communityChestType = communityChest.type.trim().toLowerCase();

        switch (communityChestType) {
          case "credit_and_move":
            rent = { player: communityChest.amount, owner: 0, players: 0 };
            position = communityChest.position;
            break;
          case "debit_and_move":
            rent = { player: -communityChest.amount, owner: 0, players: 0 };
            position = communityChest.position;
            break;
          case "move":
            position =
              communityChest.position >= 0
                ? communityChest.position
                : (new_position + communityChest.position + 40) % 40;
            break;
          case "credit":
            rent = { player: communityChest.amount, owner: 0, players: 0 };
            break;
          case "debit":
            rent = { player: -communityChest.amount, owner: 0, players: 0 };
            break;
        }

        // Handle extra rule logic
        if (extra?.rule) {
          const rule = extra.rule;

          if (rule === "nearest_utility") {
            position =
              UTILITY_IDS.find((id) => id > new_position) ?? UTILITY_IDS[0];
          } else if (rule === "nearest_railroad") {
            position =
              RAILWAY_IDS.find((id) => id > new_position) ?? RAILWAY_IDS[0];
          } else if (rule === "get_out_of_jail_free") {
            await trx("game_players")
              .where({ id: game_player.id })
              .update({ community_chest_jail_card: 1 });
          } else if (rule === "go_to_jail") {
            position = 10;
            await trx("game_players").where({ id: game_player.id }).update({
              in_jail: true,
              in_jail_rolls: 0,
              position: 10,
              updated_at: now,
            });

            // Deduct GO money if passed start
            rent =
              old_position > new_position
                ? { player: -200, owner: 0, players: 0 }
                : { player: 0, owner: 0, players: 0 };
          } else if (rule === "per_player") {
            const totalAmount = -players_count * communityChest.amount;
            rent = {
              player: totalAmount,
              owner: 0,
              players: communityChest.amount,
            };
          }
        }
        comment = `${player.username} drew community chest: ${communityChest.instruction}`;
      }
    } else {
      // Normal property rent based on development level
      const development = Number(game_property.development || 0);
      const rentFields = [
        property.rent_site_only,
        property.rent_one_house,
        property.rent_two_houses,
        property.rent_three_houses,
        property.rent_four_houses,
        property.rent_hotel,
      ];

      const rentAmount =
        development >= 0 && development <= 5
          ? Number(rentFields[development] || 0)
          : 0;

      rent = { player: -rentAmount, owner: rentAmount, players: 0 };

      const devDescription =
        development === 0
          ? "site only"
          : development === 5
          ? "hotel"
          : `${development} house${development > 1 ? "s" : ""}`;

      comment = `${player.username} paid ${rentAmount} rent to ${owner.username} for ${devDescription}`;
    }

    // Process rent transfer if rent exists and setting allows
    if (rent && game_settings.rent_in_prison) {
      const updates = [];
      const historyInserts = [];

      // Helper to create history entry
      const createHistory = (playerId, amount, desc) => ({
        game_id: game.id,
        game_player_id: playerId,
        rolled,
        old_position,
        new_position: position,
        action: PROPERTY_ACTION(position),
        amount,
        extra: JSON.stringify({ description: desc }),
        comment,
        active: 1,
        created_at: now,
      });

      // Update player balance and create history
      if (rent.player !== 0) {
        updates.push(
          trx("game_players")
            .where({ id: game_player.id })
            .increment("balance", rent.player)
        );
        historyInserts.push(
          createHistory(
            game_player.id,
            rent.player,
            `You ${rent.player > 0 ? "received" : "paid"} ${Math.abs(
              rent.player
            )}`
          )
        );
      }

      // Update owner balance and create history
      if (rent.owner !== 0) {
        updates.push(
          trx("game_players")
            .where({ id: property_owner_id })
            .increment("balance", rent.owner)
        );
        historyInserts.push(
          createHistory(
            property_owner_id,
            rent.owner,
            `Owner ${rent.owner > 0 ? "received" : "paid"} ${Math.abs(
              rent.owner
            )}`
          )
        );
      }

      // Update all other players balances (bulk operation)
      if (rent.players !== 0) {
        updates.push(
          trx("game_players")
            .where("game_id", game_id)
            .where("id", "!=", game_player.id)
            .where("id", "!=", property_owner_id)
            .increment("balance", rent.players)
        );
        // Note: Individual history for each player would require fetching all player IDs
        // For now, create a single entry for the current player about other players
        historyInserts.push(
          createHistory(
            game_player.id,
            rent.players * players_count,
            `Other players ${rent.players > 0 ? "received" : "paid"} ${Math.abs(
              rent.players
            )} each`
          )
        );
      }

      // Update position if changed (e.g., chance/community chest moved player)
      if (position !== new_position) {
        updates.push(
          trx("game_players")
            .where({ id: game_player.id })
            .update({ position: position, updated_at: now })
        );
        historyInserts.push(
          createHistory(
            game_player.id,
            0,
            `Moved from position ${new_position} to ${position}`
          )
        );
      }

      // Insert trade record only if actual rent was paid (not for special cards)
      if (rent.owner !== 0 || rent.player !== 0) {
        updates.push(
          trx("game_trades").insert({
            game_id,
            from_player_id: game_player.id,
            to_player_id: property_owner_id,
            type: "CASH",
            status: "ACCEPTED",
            sending_amount: Math.abs(rent.player),
            receiving_amount: Math.abs(rent.owner),
            created_at: now,
            updated_at: now,
          })
        );
      }

      // Execute all balance updates first, then insert histories
      await Promise.all(updates);

      // Insert all history records
      if (historyInserts.length > 0) {
        await trx("game_play_history").insert(historyInserts);
      }
    }

    return {
      success: true,
      rent,
      position,
      comment,
      card: chanceCard,
      message: comment,
    };
  } catch (err) {
    console.error("Error in payRent:", err);
    return {
      success: false,
      message: err.message || "Failed to process rent payment",
    };
  }
};

const gamePlayerController = {
  async create(req, res) {
    try {
      const { address, code } = req.body;
      const user = await User.findByAddress(address);
      if (!user) {
        res.status(200).json({ success: false, message: "User not found" });
      }
      const game = await Game.findByCode(code);
      if (!game) {
        res.status(200).json({ success: false, message: "Game not found" });
      }
      const settings = await GameSetting.findByGameId(game.id);
      if (!settings) {
        res
          .status(200)
          .json({ success: false, message: "Game settings not found" });
      }
      const players = await GamePlayer.findByGameId(game.id);
      if (!players) {
        res
          .status(200)
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
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async join(req, res) {
    try {
      const { address, code, symbol } = req.body;

      // find user
      const user = await User.findByAddress(address);
      if (!user) {
        return res
          .status(200)
          .json({ success: false, message: "User not found" });
      }

      // find game
      const game = await Game.findByCode(code);
      if (!game) {
        return res
          .status(200)
          .json({ success: false, message: "Game not found" });
      }

      // find settings
      const settings = await GameSetting.findByGameId(game.id);
      if (!settings) {
        return res
          .status(200)
          .json({ success: false, message: "Game settings not found" });
      }

      // fetch players in game
      const players = await GamePlayer.findByGameId(game.id);
      if (!players) {
        return res
          .status(200)
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
      return res.status(200).json({ success: false, message: error.message });
    }
  },
  async leave(req, res) {
    try {
      const { address, code } = req.body;
      const user = await User.findByAddress(address);
      if (!user) {
        res.status(200).json({ success: false, message: "User not found" });
      }
      const game = await Game.findByCode(code);
      if (!game) {
        res.status(200).json({ success: false, message: "Game not found" });
      }
      const player = await GamePlayer.leave(game.id, user.id);
      res.status(200).json({
        success: true,
        message: "Player removed to game successfully",
      });
    } catch (error) {
      console.error("Error creating game player:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async findById(req, res) {
    try {
      const player = await GamePlayer.findById(req.params.id);
      if (!player)
        return res.status(200).json({ error: "Game player not found" });
      res.json(player);
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
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
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async findByGame(req, res) {
    try {
      const players = await GamePlayer.findByGameId(req.params.gameId);
      res.json(players);
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async findByUser(req, res) {
    try {
      const players = await GamePlayer.findByUserId(req.params.userId);
      res.json(players);
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async update(req, res) {
    try {
      const player = await GamePlayer.update(req.params.id, req.body);
      res.json(player);
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async changePosition(req, res) {
    const trx = await db.transaction();
    const now = new Date();

    // Helper for clean rollback and response
    const respondAndRollback = async (statusObj) => {
      try {
        await trx.rollback();
      } catch (e) {
        /* ignore rollback errors */
      }
      return res.status(statusObj.success ? 200 : 400).json(statusObj);
    };

    try {
      const {
        user_id,
        game_id,
        position: rawPosition,
        rolled = null,
        is_double = false,
      } = req.body;

      // Basic validation
      if (
        !user_id ||
        !game_id ||
        rawPosition === undefined ||
        rawPosition === null
      ) {
        return await respondAndRollback({
          success: false,
          message: "Missing required parameters.",
        });
      }

      const position = Number(rawPosition);
      if (isNaN(position) || position < 0 || position > 39) {
        return await respondAndRollback({
          success: false,
          message: "Invalid position value.",
        });
      }

      // Fetch and lock all required data in parallel
      const [game, game_settings, game_player, property] = await Promise.all([
        trx("games").where({ id: game_id }).forUpdate().first(),
        trx("game_settings").where({ game_id }).forUpdate().first(),
        trx("game_players").where({ user_id, game_id }).forUpdate().first(),
        trx("properties").where({ id: position }).first(),
      ]);

      // Validate fetched data
      if (!game) {
        return await respondAndRollback({
          success: false,
          message: "Game not found",
        });
      }

      if (!game_settings) {
        return await respondAndRollback({
          success: false,
          message: "Game settings not found",
        });
      }

      if (!game_player) {
        return await respondAndRollback({
          success: false,
          message: "Game player not found",
        });
      }

      if (!property) {
        return await respondAndRollback({
          success: false,
          message: "Property not found",
        });
      }

      // Ensure it's this player's turn
      if (game.next_player_id !== user_id) {
        return await respondAndRollback({
          success: false,
          message: "It is not your turn.",
        });
      }

      // Prevent double rolls in same round
      if (Number(game_player.rolls || 0) >= 1) {
        return await respondAndRollback({
          success: false,
          message: "You already rolled this round.",
        });
      }

      // Compute positions
      const old_position = Number(game_player.position || 0);
      const new_position = position;

      // Helper: create play history record
      const insertPlayHistory = async (extra = {}) => {
        await trx("game_play_history").insert({
          game_id,
          game_player_id: game_player.id,
          rolled,
          old_position,
          new_position,
          action: PROPERTY_ACTION(new_position),
          amount: 0,
          extra: JSON.stringify({
            description: `Player moved from ${old_position} → ${new_position}`,
            ...extra,
          }),
          comment: `Moved to ${property.name}`,
          active: 1,
          created_at: now,
        });
      };

      // JAIL LOGIC: Landing on position 30 (Go to Jail)
      if (!game_player.in_jail && new_position === 30) {
        await trx("game_players")
          .where({ id: game_player.id })
          .update({
            in_jail: true,
            in_jail_rolls: 0,
            position: 10, // Jail is at position 10
            rolls: Number(game_player.rolls || 0) + 1,
            updated_at: now,
          });

        await insertPlayHistory({ jail: true });
        await trx.commit();

        return res.json({
          success: true,
          message: "You've been sent to jail!",
        });
      }

      // Check if player can leave jail
      const canLeaveJail = game_player.in_jail
        ? Number(game_player.in_jail_rolls || 0) >= 2 || // 3rd roll means 2 previous rolls
          Number(rolled || 0) >= 12 ||
          Boolean(is_double)
        : true; // Not in jail, can move freely

      if (canLeaveJail) {
        // Player is moving (either normal move or leaving jail)
        const passedStart = new_position < old_position;

        // Build update object
        const updatedFields = {
          position: new_position,
          rolls: Number(game_player.rolls || 0) + 1,
          updated_at: now,
        };

        // Reset jail flags if leaving jail
        if (game_player.in_jail) {
          updatedFields.in_jail = false;
          updatedFields.in_jail_rolls = 0;
        }

        // Award GO money if passed start
        if (passedStart) {
          updatedFields.circle = Number(game_player.circle || 0) + 1;
          updatedFields.balance = Number(game_player.balance || 0) + 200;
        }

        // Update player position and state
        await trx("game_players")
          .where({ id: game_player.id })
          .update(updatedFields);

        // Process rent/property action (pass transaction context)
        const pay_rent = await payRent(
          {
            game_id: game.id,
            property_id: property.id,
            player_id: game_player.id,
            old_position: old_position,
            new_position: new_position,
            rolled,
          },
          trx // Pass transaction to prevent nested transactions
        );

        // Check rent payment result
        if (!pay_rent || !pay_rent.success) {
          return await respondAndRollback({
            success: false,
            message: "Failed to process property action",
          });
        }

        // Log move to history
        await insertPlayHistory({
          rent: pay_rent.rent,
          final_position: pay_rent.position || new_position,
        });

        // Commit transaction
        await trx.commit();

        return res.json({
          success: true,
          message: "Position updated successfully.",
          data: {
            new_position: pay_rent.position || new_position,
            rent_paid: pay_rent.rent,
            passed_go: passedStart,
          },
        });
      } else {
        // Player stays in jail (used a roll but didn't escape)
        await trx("game_players")
          .where({ id: game_player.id })
          .update({
            in_jail_rolls: Number(game_player.in_jail_rolls || 0) + 1,
            rolls: Number(game_player.rolls || 0) + 1,
            updated_at: now,
          });

        await insertPlayHistory({ stayed_in_jail: true });
        await trx.commit();

        return res.json({
          success: true,
          message: "Still in jail. Try again next turn.",
          data: {
            in_jail: true,
            jail_rolls: Number(game_player.in_jail_rolls || 0) + 1,
          },
        });
      }
    } catch (error) {
      try {
        await trx.rollback();
      } catch (e) {
        /* ignore rollback errors */
      }
      console.error("changePosition error:", error);
      return res.status(500).json({
        success: false,
        message: error?.message || "Internal server error",
      });
    }
  },
  async endTurn(req, res) {
    const trx = await db.transaction();

    try {
      const { user_id, game_id } = req.body;

      // 1️⃣ Lock game row
      const game = await trx("games")
        .where({ id: game_id })
        .forUpdate()
        .first();
      if (!game) {
        await trx.rollback();
        return res
          .status(200)
          .json({ success: false, message: "Game not found" });
      }

      // Must be this player’s turn
      if (game.next_player_id !== user_id) {
        await trx.rollback();
        return res.status(200).json({
          success: false,
          message: "You cannot end another player's turn.",
        });
      }

      // 2️⃣ Fetch and lock all players
      const players = await trx("game_players")
        .where({ game_id })
        .forUpdate()
        .orderBy("turn_order", "asc");

      if (!players.length) {
        await trx.rollback();
        return res
          .status(200)
          .json({ success: false, message: "No players found in game" });
      }

      const currentIdx = players.findIndex((p) => p.user_id === user_id);
      const nextIdx = currentIdx === players.length - 1 ? 0 : currentIdx + 1;
      const next_player = players[nextIdx];

      // 3️⃣ Mark last history as inactive
      const last_active = await trx("game_play_history")
        .where({ game_id, active: 1 })
        .orderBy("id", "desc")
        .first();

      if (last_active) {
        await trx("game_play_history")
          .where({ id: last_active.id })
          .update({ active: 0 });
      }

      // 4️⃣ Update next player turn
      await trx("games").where({ id: game.id }).update({
        next_player_id: next_player.user_id,
        updated_at: new Date(),
      });

      // 5️⃣ Check if all players have rolled once (end of round)
      const allRolled = players.every((p) => Number(p.rolls || 0) >= 1);

      if (allRolled) {
        await trx("game_players").where({ game_id }).update({ rolls: 0 });
      }

      await trx.commit();

      res.json({
        success: true,
        message: "Turn ended. Next player set.",
      });
    } catch (error) {
      await trx.rollback();
      console.error("endTurn error:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async canRoll(req, res) {
    const trx = await db.transaction();

    try {
      const { user_id, game_id } = req.body;

      // Validate required fields
      if (!user_id || !game_id) {
        await trx.rollback();
        return res
          .status(200)
          .json({ success: false, message: "Missing user_id or game_id." });
      }

      // 1️⃣ Lock game row
      const game = await trx("games")
        .where({ id: game_id })
        .forUpdate()
        .first();
      if (!game) {
        await trx.rollback();
        return res
          .status(200)
          .json({ success: false, message: "Game not found." });
      }

      // 2️⃣ Lock player row
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .forUpdate()
        .first();
      if (!player) {
        await trx.rollback();
        return res
          .status(200)
          .json({ success: false, message: "Player not found in game." });
      }

      // 3️⃣ Check if it's the player's turn
      if (game.next_player_id !== user_id) {
        await trx.rollback();
        return res.status(200).json({
          success: false,
          message: "It's not your turn to roll.",
          data: { canRoll: false },
        });
      }

      // 4️⃣ Optional checks: jailed, bankrupt, inactive
      if (player.is_jailed) {
        await trx.rollback();
        return res.status(200).json({
          success: false,
          message: "You cannot roll while jailed.",
          data: { canRoll: false },
        });
      }

      if (player.is_bankrupt) {
        await trx.rollback();
        return res.status(200).json({
          success: false,
          message: "You are bankrupt and cannot roll.",
          data: { canRoll: false },
        });
      }

      // 5️⃣ Prevent multiple rolls per round
      if (Number(player.rolls || 0) >= 1) {
        await trx.rollback();
        return res.status(200).json({
          success: false,
          message: "You have already rolled this round.",
          data: { canRoll: false },
        });
      }

      // ✅ Passed all checks
      await trx.commit();
      return res.status(200).json({
        success: true,
        message: "You are eligible to roll.",
        data: { canRoll: true },
      });
    } catch (error) {
      await trx.rollback();
      console.error("canRoll error:", error);
      return res.status(200).json({
        success: false,
        data: { canRoll: false },
        message: error.message,
      });
    }
  },

  async remove(req, res) {
    try {
      await GamePlayer.delete(req.params.id);
      res.json({ message: "Game player removed" });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
};

export default gamePlayerController;
