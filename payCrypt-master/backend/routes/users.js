import express from "express";
import {
  // getUsers,
  // getUserById,
  // updateUser,
  // deleteUser,
  profile,
  edit_profile,
  dashboard_summary,
} from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/profile", authenticate, profile);
router.get("/dashboard-summary", authenticate, dashboard_summary);
router.post("/profile", authenticate, edit_profile);
// router.get("/", authenticate, getUsers);
// router.get("/:id", authenticate, getUserById);
// router.put("/:id", authenticate, updateUser);
// router.delete("/:id", authenticate, deleteUser);

export default router;
