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

// POST /auth/verify/resend (NEW)
authRouter.post("/verify/resend", authController.resendVerification);

// POST /auth/forgot-password 
authRouter.post("/forgot-password", authController.forgotPassword);

// POST /auth/reset-password 
authRouter.post("/reset-password", authController.resetPassword);


// --- Protected Routes (Requires a valid token) ---

// GET /auth/me
authRouter.get("/me", requireAuth, authController.getProfile);

// POST /auth/consent/accept (NEW)
authRouter.post("/consent/accept", requireAuth, authController.acceptConsent);