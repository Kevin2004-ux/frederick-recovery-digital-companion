import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from repo root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// IMPORTANT: dynamic imports so env.ts parses AFTER dotenv loads
const { createApp } = await import("./app.js");
const { getEnv } = await import("./config/env.js");

const app = createApp();

const env = getEnv();
app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});
