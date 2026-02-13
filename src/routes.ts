import { Router } from "express";
import * as authController from "./controllers/authController.js";
import { requireAuth } from "./middleware/authMiddleware.js";

const router = Router();

// --- Auth Routes ---

// Public: Register a new user
// POST /api/auth/register
router.post("/auth/register", authController.register);

// Public: Login and get a JWT
// POST /api/auth/login
router.post("/auth/login", authController.login);

// Protected: Get current user's profile
// GET /api/auth/me
// (Notice we pass 'requireAuth' before the controller)
router.get("/auth/me", requireAuth, authController.getProfile);

// --- Health Check ---
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

export default router;