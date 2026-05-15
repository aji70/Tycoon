import express from "express";
import * as boardVariantController from "../controllers/boardVariantController.js";

const router = express.Router();

router.get("/", boardVariantController.listActive);

export default router;
