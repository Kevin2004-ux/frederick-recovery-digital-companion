// app/backend/src/server.ts
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

// Load .env only in dev/local. Render should use environment variables.
if (!isProd) {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
}

// IMPORTANT: dynamic imports so env.ts parses AFTER dotenv loads (in dev)
const { createApp } = await import("./app.js");
const { getEnv } = await import("./config/env.js");

const app = createApp();

const env = getEnv();

// Render provides PORT; fall back to env.API_PORT; then 4000.
const port = Number(process.env.PORT ?? env.API_PORT ?? 4000);

// Bind to 0.0.0.0 so Render can route traffic to your container
app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});

