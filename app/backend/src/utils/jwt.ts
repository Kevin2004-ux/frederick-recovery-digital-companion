// app/backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

export function signAccessToken(params: { sub: string; email: string }) {
  const env = getEnv();
  return jwt.sign({ sub: params.sub, email: params.email }, env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyAccessToken(token: string): { sub: string; email: string } {
  const env = getEnv();
  const payload = jwt.verify(token, env.JWT_SECRET) as any;
  return { sub: payload.sub, email: payload.email };
}
