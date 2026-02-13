import { Router } from "express";
import * as authController from "./controllers/authController.js";
/**
 * ✅ FIX: Ensure this import points to the corrected authMiddleware.
 * Our refactor in the previous step ensured requireAuth is exported here.
 */
import { requireAuth } from "./middleware/authMiddleware.js";
const router = Router();
// --- Auth Routes ---
/**
 * Public: Register a new user
 * POST /api/auth/register
 */
router.post("/auth/register", authController.register);
/**
 * Public: Login and get a JWT
 * POST /api/auth/login
 */
router.post("/auth/login", authController.login);
/**
 * Protected: Get current user's profile
 * GET /api/auth/me
 * Uses the requireAuth middleware we just fixed.
 */
router.get("/auth/me", requireAuth, authController.getProfile);
// --- Health Check ---
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "frederick-recovery-api"
    });
});
export default router;
