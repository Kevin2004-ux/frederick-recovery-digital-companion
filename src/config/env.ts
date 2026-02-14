// backend/src/config/env.ts
import { z } from "zod";

const EnvSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Render/Railway commonly set PORT. Keep API_PORT support for local dev.
    PORT: z.coerce.number().int().positive().optional(),
    API_PORT: z.coerce.number().int().positive().optional(),

    // --- SECURITY KEYS ---
    // Updated minimum length to 32 to match your new military-grade keys
    JWT_SECRET: z.string().min(32),
    // Added ENCRYPTION_KEY support (optional in schema to prevent crash if missing, but code prefers it)
    ENCRYPTION_KEY: z.string().min(32).optional(),
    // ---------------------

    DATABASE_URL: z.string().optional(),

    // For CORS allowlist
    FRONTEND_ORIGINS: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.APP_ENV === "production" && !val.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required in production",
        path: ["DATABASE_URL"],
      });
    }
  });

// Parse env lazily (after dotenv is loaded)
let _env: z.infer<typeof EnvSchema> | null = null;

export function getEnv() {
  if (_env) return _env;

  const parsed = EnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    PORT: process.env.PORT,
    API_PORT: process.env.API_PORT,
    JWT_SECRET: process.env.JWT_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY, // <--- Critical Addition
    DATABASE_URL: process.env.DATABASE_URL,
    FRONTEND_ORIGINS: process.env.FRONTEND_ORIGINS,
  });

  // Normalize a single port field used by server.ts
  const API_PORT = Number(parsed.PORT ?? parsed.API_PORT ?? 4000);

  _env = {
    ...parsed,
    API_PORT,
  };

  return _env;
}