// app/backend/src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit"; // <--- 1. Import added here

import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

function parseOrigins(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);


  // Security & parsing
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  // --- RATE LIMITING START ---
  
  // 1. Global Rate Limiter: 100 requests per 15 minutes per IP
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { code: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later." },
    standardHeaders: true, 
    legacyHeaders: false, 
  });
  // Apply globally
  app.use(globalLimiter);

  // 2. Strict Auth Limiter: 5 attempts per 15 minutes for sensitive routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { code: "TOO_MANY_ATTEMPTS", message: "Too many login attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Apply specifically to auth routes
  // Note: These paths must match exactly what you defined in your routers
  app.use("/auth/login", authLimiter);
  app.use("/auth/signup", authLimiter);
  app.use("/activation/claim", authLimiter); // <--- Protects the "Lock Moment"

  // --- RATE LIMITING END ---

  // Health check (must not be gated by auth)
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // CORS: strict allowlist. Use env FRONTEND_ORIGINS for prod.
  const allowlist = new Set<string>([
    "http://localhost:5173",
    ...parseOrigins(process.env.FRONTEND_ORIGINS),
  ]);

  app.use(
    cors({
      origin(origin, cb) {
        // allow server-to-server / curl / postman (no Origin header)
        if (!origin) return cb(null, true);
        if (allowlist.has(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked origin: ${origin}`));
      },
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      maxAge: 86400,
    })
  );

  // API routes
  app.use("/", apiRouter);

  // Global Error Handler
  app.use(errorHandler);

  // Fallback for unknown routes
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}