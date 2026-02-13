// app/backend/src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js"; // <--- Import the error handler

function parseOrigins(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();

  // Security & parsing
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  // Health check (must not be gated by auth)
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // CORS: strict allowlist. Use env FRONTEND_ORIGINS for prod.
  // Because we use Authorization: Bearer <token> (not cookies), credentials are NOT needed.
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
  // (Must be defined AFTER all routes but BEFORE the 404 fallback if you want 404s to be JSON too)
  app.use(errorHandler); 

  // Fallback for unknown routes
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}