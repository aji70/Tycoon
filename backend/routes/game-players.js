import express from "express";
import gamePlayerController from "../controllers/gamePlayerController.js";

const router = express.Router();

// -------------------------
// 🔹 CRUD
// -------------------------
router.post("/", gamePlayerController.create);
router.post("/join", gamePlayerController.join);
router.post("/leave", gamePlayerController.leave);
router.get("/", gamePlayerController.findAll);
router.get("/:id", gamePlayerController.findById);
router.put("/:id", gamePlayerController.update);
router.delete("/:id", gamePlayerController.remove);


// -------------------------
// 🔹 By Game / User
// -------------------------
router.get("/game/:gameId", gamePlayerController.findByGame);
router.get("/user/:userId", gamePlayerController.findByUser);

router.post("/change-position", gamePlayerController.changePosition);
router.post("/pay-to-leave-jail", gamePlayerController.payToLeaveJail);
router.post("/stay-in-jail", gamePlayerController.stayInJail);
router.post("/use-get-out-of-jail-free", gamePlayerController.useGetOutOfJailFree);
router.post("/end-turn", gamePlayerController.endTurn);
router.post("/can-roll", gamePlayerController.canRoll);
router.post("/remove-inactive", gamePlayerController.removeInactive);
router.post("/record-timeout", gamePlayerController.recordTimeout);
router.post("/vote-to-remove", gamePlayerController.voteToRemove);
router.post("/vote-status", gamePlayerController.getVoteStatus);
router.post("/vote-end-by-networth", gamePlayerController.voteEndByNetWorth);
router.post("/end-by-networth-status", gamePlayerController.getEndByNetWorthStatus);
export default router;
