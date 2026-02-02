import express from "express";
import cors from "cors";
import helmet from "helmet";

import { apiRouter } from "./routes/index.js";

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

  app.use(express.json({ limit: "1mb" }));

  // API routes
  app.use("/", apiRouter);

  // Fallback for unknown routes
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}
