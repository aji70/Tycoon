import express from "express";
import gamePerkController from "../controllers/gamePerkController.js"; // ← Add this import

const router = express.Router();
// -------------------------
// 🔹 Perk Actions (NEW!)
// -------------------------
// General activation for most perks (Extra Turn, Jail Free, Double Rent, etc.)
router.post("/perks/activate", gamePerkController.activatePerk);

// Special perks requiring extra input (optional from_collectible: use perk without active_perks)
router.post("/perks/teleport", gamePerkController.teleport);
router.post("/perks/exact-roll", gamePerkController.exactRoll);
router.post("/perks/burn-cash", gamePerkController.burnForCash);
router.post("/perks/use-jail-free", gamePerkController.useJailFree);
router.post("/perks/apply-cash", gamePerkController.applyCash);

export default router;