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
authRouter.post("/verify", authController.verify);

// POST /auth/forgot-password (NEW)
authRouter.post("/forgot-password", authController.forgotPassword);

// POST /auth/reset-password (NEW)
authRouter.post("/reset-password", authController.resetPassword);

// --- Protected Routes ---

// GET /auth/me
authRouter.get("/me", requireAuth, authController.getProfile);