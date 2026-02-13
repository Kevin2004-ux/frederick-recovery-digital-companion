// app/backend/src/routes/auth/index.ts
import { Router } from "express";
import * as authController from "../../controllers/authController.js"; 
import { requireAuth } from "../../middleware/requireAuth.js";

export const authRouter = Router();

// --- Public Routes ---

// POST /auth/signup
authRouter.post("/signup", authController.register);

// POST /auth/login
authRouter.post("/login", authController.login);

// POST /auth/verify
// (Requires 'verify' to be exported from authController.ts)
authRouter.post("/verify", authController.verify);

// --- Protected Routes ---

// GET /auth/me
authRouter.get("/me", requireAuth, authController.getProfile);