/**
 * Resolve tournament by id or code. Sets req.tournament and normalizes req.params.id to numeric id.
 * INVITE_ONLY: requires ?invite= token (GET) or body.invite_token (POST), unless the user is the creator.
 */
import Tournament from "../models/Tournament.js";

export async function resolveTournament(req, res, next) {
  const idOrCode = req.params.id;
  if (!idOrCode) return res.status(400).json({ success: false, message: "Tournament id or code required" });
  const tournament = await Tournament.findByIdOrCode(idOrCode);
  if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
  req.tournament = tournament;
  req.params.id = String(tournament.id);

  const vis = String(tournament.visibility || "OPEN").toUpperCase();
  if (vis === "INVITE_ONLY") {
    const invite = String(req.query.invite || req.body?.invite_token || "").trim();
    const isCreator = req.user?.id && Number(req.user.id) === Number(tournament.creator_id);
    if (!isCreator && (!invite || invite !== tournament.invite_token)) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }
  }

  next();
}
