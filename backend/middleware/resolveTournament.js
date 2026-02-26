/**
 * Resolve tournament by id or code. Sets req.tournament and normalizes req.params.id to numeric id.
 */
import Tournament from "../models/Tournament.js";

export async function resolveTournament(req, res, next) {
  const idOrCode = req.params.id;
  if (!idOrCode) return res.status(400).json({ success: false, message: "Tournament id or code required" });
  const tournament = await Tournament.findByIdOrCode(idOrCode);
  if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
  req.tournament = tournament;
  req.params.id = String(tournament.id);
  next();
}
