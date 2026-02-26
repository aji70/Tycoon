// src/controllers/gamePerkController.js
import db from "../config/database.js";

const getPerkName = (id) => {
  const names = {
    1: "Extra Turn",
    2: "Jail Free Card",
    3: "Double Rent",
    4: "Roll Boost",
    5: "Instant Cash",
    6: "Teleport",
    7: "Shield",
    8: "Property Discount",
    9: "Tax Refund",
    10: "Exact Roll",
  };
  return names[id] || "Unknown Perk";
};

const gamePerkController = {
  async activatePerk(req, res) {
  const trx = await db.transaction();
  try {
    const { game_id, perk_id } = req.body;
    const user_id = req.user?.id; // assuming authenticated

    if (!game_id || !perk_id) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Missing game_id or perk_id" });
    }

    const validPerks = [1, 2, 3, 4, 7, 8, 9]; // Extra Turn, Jail Free, Double Rent, Roll Boost, Shield, Property Discount, Tax Refund
    if (!validPerks.includes(Number(perk_id))) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Invalid perk for this endpoint" });
    }

    const [game, player] = await Promise.all([
      trx("games").where({ id: game_id }).first(),
      trx("game_players").where({ game_id, user_id }).first(),
    ]);

    if (!game || !player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Game or player not found" });
    }

    // Example: store active perk in player row (you can use a JSON field or separate table)
    const activePerks = player.active_perks ? JSON.parse(player.active_perks) : [];

    // Prevent duplicates where needed
    if ([3, 7, 8].includes(Number(perk_id))) { // Double Rent, Shield, Property Discount
      const exists = activePerks.some(p => p.id === Number(perk_id));
      if (exists) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "This perk is already active" });
      }
    }

    activePerks.push({
      id: Number(perk_id),
      activated_at: new Date(),
    });

    await trx("game_players")
      .where({ id: player.id })
      .update({
        active_perks: JSON.stringify(activePerks),
        updated_at: new Date(),
      });

    // Optional: log to history
    await trx("game_play_history").insert({
      game_id,
      game_player_id: player.id,
      action: "PERK_ACTIVATED",
      extra: JSON.stringify({ perk_id, name: getPerkName(perk_id) }),
      comment: `Activated perk: ${getPerkName(perk_id)}`,
      active: 1,
      created_at: new Date(),
    });

    await trx.commit();

    return res.json({
      success: true,
      message: `${getPerkName(perk_id)} activated!`,
    });
  } catch (error) {
    await trx.rollback();
    console.error("activatePerk error:", error);
    return res.status(500).json({ success: false, message: "Failed to activate perk" });
  }
},
async teleport(req, res) {
  const trx = await db.transaction();
  try {
    const { game_id, target_position } = req.body;
    const user_id = req.user?.id;

    if (!game_id || target_position === undefined || target_position < 0 || target_position > 39) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Invalid position (0-39)" });
    }

    const player = await trx("game_players")
      .where({ game_id, user_id })
      .first();

    if (!player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    // Check if player has active Teleport perk
    const activePerks = player.active_perks ? JSON.parse(player.active_perks) : [];
    const teleportPerk = activePerks.find(p => p.id === 6);
    if (!teleportPerk) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Teleport perk not active" });
    }

    // Remove perk after use
    const updatedPerks = activePerks.filter(p => p.id !== 6);

    await trx("game_players")
      .where({ id: player.id })
      .update({
        position: target_position,
        active_perks: JSON.stringify(updatedPerks),
        updated_at: new Date(),
      });

    await trx("game_play_history").insert({
      game_id,
      game_player_id: player.id,
      action: "PERK_TELEPORT",
      extra: JSON.stringify({ from: player.position, to: target_position }),
      comment: "Used Teleport perk",
      active: 1,
      created_at: new Date(),
    });

    await trx.commit();

    return res.json({
      success: true,
      message: "Teleported successfully!",
      new_position: target_position,
    });
  } catch (error) {
    await trx.rollback();
    return res.status(500).json({ success: false, message: "Teleport failed" });
  }
},
async exactRoll(req, res) {
  const trx = await db.transaction();
  try {
    const { game_id, chosen_total } = req.body;
    const user_id = req.user?.id;

    if (!chosen_total || chosen_total < 2 || chosen_total > 12) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Roll must be 2–12" });
    }

    const player = await trx("game_players")
      .where({ game_id, user_id })
      .first();

    if (!player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    const activePerks = player.active_perks ? JSON.parse(player.active_perks) : [];
    const exactRollPerk = activePerks.find(p => p.id === 10);
    if (!exactRollPerk) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Exact Roll perk not active" });
    }

    // Store chosen roll (you can use a temp field or proceed with move)
    await trx("game_players")
      .where({ id: player.id })
      .update({
        pending_exact_roll: chosen_total,
        active_perks: JSON.stringify(activePerks.filter(p => p.id !== 10)),
        updated_at: new Date(),
      });

    await trx.commit();

    return res.json({
      success: true,
      message: `Next roll will be exactly ${chosen_total}!`,
      chosen_total,
    });
  } catch (error) {
    await trx.rollback();
    return res.status(500).json({ success: false, message: "Exact roll failed" });
  }
},
async burnForCash(req, res) {
  const trx = await db.transaction();
  try {
    const { game_id } = req.body;
    const user_id = req.user?.id;

    const player = await trx("game_players")
      .where({ game_id, user_id })
      .first();

    if (!player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    const activePerks = player.active_perks ? JSON.parse(player.active_perks) : [];
    const instantCashPerk = activePerks.find(p => p.id === 5);
    if (!instantCashPerk) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Instant Cash perk not active" });
    }

    // Tiered reward example
    const tierRewards = [500, 1000, 2000, 5000];
    const tier = Math.floor(Math.random() * tierRewards.length);
    const reward = tierRewards[tier];

    const updatedPerks = activePerks.filter(p => p.id !== 5);

    await trx("game_players")
      .where({ id: player.id })
      .update({
        balance: player.balance + reward,
        active_perks: JSON.stringify(updatedPerks),
        updated_at: new Date(),
      });

    await trx("game_play_history").insert({
      game_id,
      game_player_id: player.id,
      action: "PERK_BURN_CASH",
      amount: reward,
      comment: `Burned Instant Cash perk → +$${reward.toLocaleString()}`,
      active: 1,
      created_at: new Date(),
    });

    await trx.commit();

    return res.json({
      success: true,
      message: `Burned for $${reward.toLocaleString()} TYC!`,
      reward,
    });
  } catch (error) {
    await trx.rollback();
    return res.status(500).json({ success: false, message: "Burn failed" });
  }
}
};

export default gamePerkController;