import { Router } from "express";
import { authRouter } from "./routes/auth/index.js";
import { userRouter } from "./routes/user/index.js";
import { clinicRouter } from "./routes/clinic/index.js";
import { planRouter } from "./routes/plan/index.js";
import { logRouter } from "./routes/log/index.js"; // ✅ added

// Note: We do NOT import requireAuth here.
// The sub-routers (user, clinic, plan, log) handle their own security internally.

export const router = Router();

// --- Mount the Sub-Routers ---

// 1. Auth (Login, Signup, Reset Password)
router.use("/auth", authRouter);

// 2. User (Profile, Settings)
router.use("/user", userRouter);

// 3. Clinic (Dashboard, Patient Management)
router.use("/clinic", clinicRouter);

// 4. Recovery Plan (Daily Tasks, Progress)
router.use("/plan", planRouter);

// 5. Patient Daily Logs (Check-ins) ✅ added
router.use("/log", logRouter);

// --- Health Check ---
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Frederick Recovery Backend",
  });
});