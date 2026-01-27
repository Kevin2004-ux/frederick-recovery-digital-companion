import { z } from "zod";

const EnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(20),
  DATABASE_URL: z.string().optional(),
});


export const env = EnvSchema.parse({
  APP_ENV: process.env.APP_ENV,
  API_PORT: process.env.API_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
});
