import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import GameSetting from "../models/GameSetting.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { PROPERTY_ACTION } from "../utils/properties.js";
import db from "../config/database.js";

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

    // small helpers
    const respondAndRollback = async (statusObj) => {
      try {
        await trx.rollback();
      } catch (e) {
        /* ignore rollback errors */
      }
      return res.status(200).json(statusObj);
    };

    try {
      const {
        user_id,
        game_id,
        position: rawPosition,
        rolled = null,
        is_double = false,
      } = req.body;

      // basic validation
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

      // 1️⃣ Lock game row
      const game = await trx("games")
        .where({ id: game_id })
        .forUpdate()
        .first();
      if (!game) {
        return await respondAndRollback({
          success: false,
          message: "Game not found",
        });
      }

      // Get game settings and lock (settings are game-scoped)
      const game_settings = await trx("game_settings")
        .where({ game_id })
        .forUpdate()
        .first();
      if (!game_settings) {
        return await respondAndRollback({
          success: false,
          message: "Game settings not found",
        });
      }

      // Ensure it’s this player's turn
      if (game.next_player_id !== user_id) {
        return await respondAndRollback({
          success: false,
          message: "It is not your turn.",
        });
      }

      // 2️⃣ Lock player row
      const game_player = await trx("game_players")
        .where({ user_id, game_id })
        .forUpdate()
        .first();
      if (!game_player) {
        return await respondAndRollback({
          success: false,
          message: "Game player not found",
        });
      }

      // Prevent double rolls in same round
      if (Number(game_player.rolls || 0) >= 1) {
        return await respondAndRollback({
          success: false,
          message: "You already rolled this round.",
        });
      }

      // 3️⃣ Validate position (no special lock needed)
      const property = await trx("properties").where({ id: position }).first();
      if (!property) {
        return await respondAndRollback({
          success: false,
          message: "Property not found",
        });
      }

      // 4️⃣ Compute new values
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

      // JAIL logic: landing on 30 sends to jail (position 10) if not already in jail
      if (!game_player.in_jail && new_position === 30) {
        await trx("game_players")
          .where({ id: game_player.id })
          .update({
            in_jail: true,
            in_jail_rolls: 0,
            position: 10,
            rolls: Number(game_player.rolls || 0) + 1,
            updated_at: now,
          });

        await insertPlayHistory();
        await trx.commit();

        return res.json({
          success: true,
          message: "Position updated successfully.",
        });
      }

      // Determine whether player is leaving jail or normal move
      const leavingJailCondition =
        (!game_player.in_jail && new_position !== 30) ||
        (game_player.in_jail &&
          (Number(game_player.in_jail_rolls || 0) >= 3 ||
            Number(rolled || 0) >= 12 ||
            Boolean(is_double)));

      if (leavingJailCondition) {
        const passedStart = new_position < old_position;
        const updatedFields = {
          position: new_position,
          rolls: Number(game_player.rolls || 0) + 1,
          updated_at: now,
          // if in jail, reset jail flags
          ...(game_player.in_jail ? { in_jail: false, in_jail_rolls: 0 } : {}),
        };

        if (passedStart) {
          updatedFields.circle = Number(game_player.circle || 0) + 1;
          updatedFields.balance = Number(game_player.balance || 0) + 200;
        }

        // 5️⃣ Update player
        await trx("game_players")
          .where({ id: game_player.id })
          .update(updatedFields);

        // 6️⃣ Log move
        await insertPlayHistory();

        // 7️⃣ Handle landing on owned property (rent)
        const game_property = await trx("game_properties")
          .where({ game_id: game.id, property_id: property.id })
          .first();

        if (
          game_property &&
          game_property.player_id !== game_player.id &&
          !game_property.mortgaged
        ) {
          const property_owner_id = game_property.player_id;

          // Get property owner (lock to be safe for balance updates)
          const property_owner = await trx("game_players")
            .where({ id: property_owner_id })
            .first();

          if (property_owner) {
            let rent = 0;

            // Railways (IDs: 5,15,25,35) - number owned by owner in this game
            const RAILWAY_IDS = [5, 15, 25, 35];
            const UTILITY_IDS = [12, 28];

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
              switch (owned) {
                case 1:
                  rent = 25;
                  break;
                case 2:
                  rent = 50;
                  break;
                case 3:
                  rent = 100;
                  break;
                case 4:
                  rent = 200;
                  break;
                default:
                  rent = 0;
              }
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
              switch (owned) {
                case 1:
                  rent = Number(rolled || 0) * 4;
                  break;
                case 2:
                  rent = Number(rolled || 0) * 10;
                  break;
                default:
                  rent = 0;
              }
            } else {
              // Normal property rent based on development level
              switch (Number(game_property.development || 0)) {
                case 0:
                  rent = Number(property.rent_site_only || 0);
                  break;
                case 1:
                  rent = Number(property.rent_one_house || 0);
                  break;
                case 2:
                  rent = Number(property.rent_two_houses || 0);
                  break;
                case 3:
                  rent = Number(property.rent_three_houses || 0);
                  break;
                case 4:
                  rent = Number(property.rent_four_houses || 0);
                  break;
                case 5:
                  rent = Number(property.rent_hotel || 0);
                  break;
                default:
                  rent = 0;
              }
            }

            // 8️⃣ Process rent transfer if applicable & enabled
            if (rent > 0 && game_settings.rent_in_prison) {
              // Decrement payer balance and increment owner balance atomically in transaction
              await trx("game_players")
                .where({ id: game_player.id })
                .decrement("balance", rent);
              await trx("game_players")
                .where({ id: property_owner_id })
                .increment("balance", rent);

              // Insert trade record
              await trx("game_trades").insert({
                game_id,
                from_player_id: game_player.id,
                to_player_id: property_owner_id,
                type: "CASH",
                status: "ACCEPTED",
                sending_amount: rent,
                receiving_amount: rent,
                created_at: now,
                updated_at: now,
              });
            }
          }
        }

        // commit everything
        await trx.commit();
        return res.json({
          success: true,
          message: "Position updated successfully.",
        });
      } else {
        // Player stays in jail and uses a jail roll
        await trx("game_players")
          .where({ id: game_player.id })
          .update({
            in_jail_rolls: Number(game_player.in_jail_rolls || 0) + 1,
            rolls: Number(game_player.rolls || 0) + 1,
            updated_at: now,
          });

        await trx.commit();
        return res.json({
          success: true,
          message: "Position updated successfully.",
        });
      }
    } catch (error) {
      try {
        await trx.rollback();
      } catch (e) {
        /* ignore */
      }
      console.error("changePosition error:", error);
      return res
        .status(200)
        .json({ success: false, message: error?.message || "Internal error" });
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
