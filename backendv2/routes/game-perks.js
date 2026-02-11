import express from "express";
import gamePerkController from "../controllers/gamePerkController.js"; // ← Add this import

const router = express.Router();
// -------------------------
// 🔹 Perk Actions (NEW!)
// -------------------------
// General activation for most perks (Extra Turn, Jail Free, Double Rent, etc.)
router.post("/perks/activate", gamePerkController.activatePerk);

// Special perks requiring extra input
router.post("/perks/teleport", gamePerkController.teleport);           // Teleport to any position
router.post("/perks/exact-roll", gamePerkController.exactRoll);        // Choose exact dice total
router.post("/perks/burn-cash", gamePerkController.burnForCash);       // Instant Cash → tiered TYC reward

export default router;