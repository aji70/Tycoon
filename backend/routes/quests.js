import express from "express";
import * as questsPublicController from "../controllers/questsPublicController.js";

const router = express.Router();

router.get("/", questsPublicController.listPublicQuests);

export default router;
