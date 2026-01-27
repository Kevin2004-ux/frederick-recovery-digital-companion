import express from "express";
import cors from "cors";
import helmet from "helmet";

import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  // Security & parsing
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // API routes
  app.use("/", apiRouter);

  // Fallback for unknown routes
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}
