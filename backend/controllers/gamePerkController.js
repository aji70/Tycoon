// src/controllers/gamePerkController.js
import db from "../config/database.js";

function parseActivePerks(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function collectUserAddresses(user, body = {}) {
  const candidates = [
    user?.address,
    user?.linked_wallet_address,
    user?.smart_wallet_address,
    body?.address,
  ];
  return [
    ...new Set(
      candidates
        .filter((a) => a && /^0x[a-fA-F0-9]{40}$/.test(String(a).trim()))
        .map((a) => String(a).trim().toLowerCase())
    ),
  ];
}

/** Match game player by JWT user_id, then by wallet addresses (MiniPay / smart wallet). */
async function resolveGamePlayer(trx, gameId, req) {
  const gid = Number(gameId);
  if (!Number.isFinite(gid) || gid <= 0) return { game: null, player: null };

  const game = await trx("games").where({ id: gid }).first();
  if (!game) return { game: null, player: null };

  const userId = req.user?.id ?? req.userId;
  if (userId != null) {
    const byUser = await trx("game_players").where({ game_id: gid, user_id: userId }).first();
    if (byUser) return { game, player: byUser };
  }

  for (const addr of collectUserAddresses(req.user, req.body)) {
    const byAddr = await trx("game_players")
      .where({ game_id: gid })
      .whereRaw("LOWER(TRIM(address)) = ?", [addr])
      .first();
    if (byAddr) return { game, player: byAddr };
  }

  return { game, player: null };
}

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
    11: "Rent Cashback",
    12: "Interest",
    13: "Lucky 7",
    14: "Free Parking Bonus",
  };
  return names[id] || "Unknown Perk";
};

const gamePerkController = {
  async activatePerk(req, res) {
  const trx = await db.transaction();
  try {
    const { game_id, perk_id } = req.body;

    if (!game_id || !perk_id) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Missing game_id or perk_id" });
    }

    const validPerks = [1, 2, 3, 4, 7, 8, 9, 11, 12, 13, 14]; // 11 Rent Cashback, 12 Interest, 13 Lucky 7, 14 Free Parking
    if (!validPerks.includes(Number(perk_id))) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Invalid perk for this endpoint" });
    }

    const { game, player } = await resolveGamePlayer(trx, game_id, req);

    if (!game || !player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Game or player not found" });
    }

    const activePerks = parseActivePerks(player.active_perks);
    const pid = Number(perk_id);

    // Lucky 7 (13): one-shot — set next roll to 7, do not add to active_perks
    if (pid === 13) {
      await trx("game_players")
        .where({ id: player.id })
        .update({
          pending_exact_roll: 7,
          updated_at: new Date(),
        });
      await trx("game_play_history").insert({
        game_id,
        game_player_id: player.id,
        action: "PERK_ACTIVATED",
        extra: JSON.stringify({ perk_id: 13, name: getPerkName(13) }),
        comment: "Lucky 7 — next roll will be 7!",
        active: 1,
        created_at: new Date(),
      });
      await trx.commit();
      return res.json({
        success: true,
        message: "Lucky 7! Your next roll will be 7.",
      });
    }

    // Prevent duplicates where needed (one active per type)
    if ([3, 7, 8, 11, 12, 14].includes(pid)) {
      const exists = activePerks.some(p => p.id === pid);
      if (exists) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "This perk is already active" });
      }
    }

    activePerks.push({
      id: pid,
      activated_at: new Date(),
    });

    await trx("game_players")
      .where({ id: player.id })
      .update({
        active_perks: JSON.stringify(activePerks),
        updated_at: new Date(),
      });

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
    const { game_id, target_position, from_collectible } = req.body;

    if (!game_id || target_position === undefined || target_position < 0 || target_position > 39) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Invalid position (0-39)" });
    }

    const { player } = await resolveGamePlayer(trx, game_id, req);

    if (!player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    let updatedPerks = parseActivePerks(player.active_perks);
    if (!from_collectible) {
      const teleportPerk = updatedPerks.find(p => p.id === 6);
      if (!teleportPerk) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Teleport perk not active" });
      }
      updatedPerks = updatedPerks.filter(p => p.id !== 6);
    }

    await trx("game_players")
      .where({ id: player.id })
      .update({
        position: target_position,
        active_perks: from_collectible ? player.active_perks : JSON.stringify(updatedPerks),
        updated_at: new Date(),
      });

    await trx("game_play_history").insert({
      game_id,
      game_player_id: player.id,
      action: "PERK_TELEPORT",
      extra: JSON.stringify({ from: player.position, to: target_position, from_collectible: !!from_collectible }),
      comment: from_collectible ? "Used Teleport (collectible)" : "Used Teleport perk",
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
    const { game_id, chosen_total, from_collectible } = req.body;

    if (!chosen_total || chosen_total < 2 || chosen_total > 12) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: "Roll must be 2–12" });
    }

    const { player } = await resolveGamePlayer(trx, game_id, req);

    if (!player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    let activePerks = parseActivePerks(player.active_perks);
    if (!from_collectible) {
      const exactRollPerk = activePerks.find(p => p.id === 10);
      if (!exactRollPerk) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Exact Roll perk not active" });
      }
      activePerks = activePerks.filter(p => p.id !== 10);
    }

    await trx("game_players")
      .where({ id: player.id })
      .update({
        pending_exact_roll: chosen_total,
        active_perks: from_collectible ? player.active_perks : JSON.stringify(activePerks),
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
    const { game_id, from_collectible, amount: requestedAmount } = req.body;

    const { player } = await resolveGamePlayer(trx, game_id, req);

    if (!player) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    let updatedPerks = parseActivePerks(player.active_perks);
    if (!from_collectible) {
      const instantCashPerk = updatedPerks.find(p => p.id === 5);
      if (!instantCashPerk) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Instant Cash perk not active" });
      }
      updatedPerks = updatedPerks.filter(p => p.id !== 5);
    }

    const tierRewards = [500, 1000, 2000, 5000];
    const parsedAmount = requestedAmount != null ? Number(requestedAmount) : NaN;
    const reward =
      from_collectible && Number.isFinite(parsedAmount) && parsedAmount >= 0
        ? parsedAmount
        : tierRewards[Math.floor(Math.random() * tierRewards.length)];

    await trx("game_players")
      .where({ id: player.id })
      .update({
        balance: Number(player.balance) + reward,
        active_perks: from_collectible ? player.active_perks : JSON.stringify(updatedPerks),
        updated_at: new Date(),
      });

    await trx("game_play_history").insert({
      game_id,
      game_player_id: player.id,
      action: "PERK_BURN_CASH",
      amount: reward,
      extra: from_collectible ? JSON.stringify({ from_collectible: true }) : null,
      comment: `Burned Instant Cash perk → +$${reward.toLocaleString()}${from_collectible ? " (collectible)" : ""}`,
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
},

  async useJailFree(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, from_collectible } = req.body;

      if (!game_id) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Missing game_id" });
      }

      const { player } = await resolveGamePlayer(trx, game_id, req);

      if (!player) {
        await trx.rollback();
        return res.status(404).json({ success: false, message: "Player not found" });
      }

      if (!player.in_jail) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Player is not in jail" });
      }

      let updatedPerks = parseActivePerks(player.active_perks);
      if (!from_collectible) {
        const jailFreePerk = updatedPerks.find(p => p.id === 2);
        if (!jailFreePerk) {
          await trx.rollback();
          return res.status(400).json({ success: false, message: "Jail Free perk not active" });
        }
        updatedPerks = updatedPerks.filter(p => p.id !== 2);
      }

      await trx("game_players")
        .where({ id: player.id })
        .update({
          in_jail: false,
          in_jail_rolls: 0,
          active_perks: from_collectible ? player.active_perks : JSON.stringify(updatedPerks),
          updated_at: new Date(),
        });

      await trx("game_play_history").insert({
        game_id,
        game_player_id: player.id,
        action: "PERK_ACTIVATED",
        extra: JSON.stringify({ perk_id: 2, name: getPerkName(2), from_collectible: !!from_collectible }),
        comment: from_collectible ? "Used Jail Free (collectible)" : "Used Jail Free perk",
        active: 1,
        created_at: new Date(),
      });

      await trx.commit();

      return res.json({
        success: true,
        message: "Escaped jail!",
      });
    } catch (error) {
      await trx.rollback();
      return res.status(500).json({ success: false, message: "Jail Free use failed" });
    }
  },

  async useExtraTurn(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, from_collectible } = req.body;

      if (!game_id) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Missing game_id" });
      }

      const { game, player } = await resolveGamePlayer(trx, game_id, req);

      if (!game || !player) {
        await trx.rollback();
        return res.status(404).json({ success: false, message: "Game or player not found" });
      }

      if (Number(game.next_player_id) !== Number(player.user_id)) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "It is not your turn." });
      }

      if (Number(player.rolls || 0) < 1) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Roll once before using Extra Turn.",
        });
      }

      let updatedPerks = parseActivePerks(player.active_perks);
      if (!from_collectible) {
        const extraTurnPerk = updatedPerks.find((p) => p.id === 1);
        if (!extraTurnPerk) {
          await trx.rollback();
          return res.status(400).json({ success: false, message: "Extra Turn perk not active" });
        }
        updatedPerks = updatedPerks.filter((p) => p.id !== 1);
      }

      await trx("game_players")
        .where({ id: player.id })
        .update({
          rolls: Math.max(0, Number(player.rolls || 0) - 1),
          active_perks: from_collectible ? player.active_perks : JSON.stringify(updatedPerks),
          updated_at: new Date(),
        });

      await trx("game_play_history").insert({
        game_id,
        game_player_id: player.id,
        action: "PERK_ACTIVATED",
        extra: JSON.stringify({ perk_id: 1, name: getPerkName(1), from_collectible: !!from_collectible }),
        comment: from_collectible ? "Used Extra Turn (collectible)" : "Used Extra Turn perk",
        active: 1,
        created_at: new Date(),
      });

      await trx.commit();

      return res.json({
        success: true,
        message: "Extra Turn granted! Roll again.",
      });
    } catch (error) {
      await trx.rollback();
      console.error("useExtraTurn error:", error);
      return res.status(500).json({ success: false, message: "Extra Turn failed" });
    }
  },

  async applyCash(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, perk_id, amount, from_collectible } = req.body;

      if (!game_id || !perk_id || amount === undefined || amount === null) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Missing game_id, perk_id, or amount" });
      }

      const pid = Number(perk_id);
      if (pid !== 8 && pid !== 9) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "perk_id must be 8 (Property Discount) or 9 (Tax Refund)" });
      }

      const value = Math.max(0, Number(amount));

      const { player } = await resolveGamePlayer(trx, game_id, req);

      if (!player) {
        await trx.rollback();
        return res.status(404).json({ success: false, message: "Player not found" });
      }

      let updatedPerks = parseActivePerks(player.active_perks);
      if (!from_collectible) {
        const perk = updatedPerks.find(p => p.id === pid);
        if (!perk) {
          await trx.rollback();
          return res.status(400).json({ success: false, message: `${getPerkName(pid)} not active` });
        }
        updatedPerks = updatedPerks.filter(p => p.id !== pid);
      }

      await trx("game_players")
        .where({ id: player.id })
        .update({
          balance: Number(player.balance) + value,
          active_perks: from_collectible ? player.active_perks : JSON.stringify(updatedPerks),
          updated_at: new Date(),
        });

      await trx("game_play_history").insert({
        game_id,
        game_player_id: player.id,
        action: "PERK_ACTIVATED",
        amount: value,
        extra: JSON.stringify({ perk_id: pid, name: getPerkName(pid), from_collectible: !!from_collectible }),
        comment: `${getPerkName(pid)} → +$${value.toLocaleString()}${from_collectible ? " (collectible)" : ""}`,
        active: 1,
        created_at: new Date(),
      });

      await trx.commit();

      return res.json({
        success: true,
        message: `+$${value.toLocaleString()} applied!`,
        amount: value,
      });
    } catch (error) {
      await trx.rollback();
      return res.status(500).json({ success: false, message: "Apply cash failed" });
    }
  },
};

export default gamePerkController;