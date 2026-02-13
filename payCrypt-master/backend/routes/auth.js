import express from "express";
import { register, login } from "../controllers/authController.js";
import { validate } from "../middleware/validation.js";
import { authSchemas } from "../schemas/auth.js";

const router = express.Router();

router.post("/register", validate(authSchemas.register), register);
router.post("/login", validate(authSchemas.login), login);

export default router;
