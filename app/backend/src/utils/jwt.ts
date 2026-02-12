// app/backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

// Update the params to include role
export function signAccessToken(params: { sub: string; email: string; role: string }) {
  const env = getEnv();
  return jwt.sign({ sub: params.sub, email: params.email, role: params.role }, env.JWT_SECRET, {
    expiresIn: "7d", // 7 days expiration
  });
}

// Verify and include the role in the payload
export function verifyAccessToken(token: string): { sub: string; email: string; role: string } {
  const env = getEnv();
  const payload = jwt.verify(token, env.JWT_SECRET) as any;
  return { sub: payload.sub, email: payload.email, role: payload.role }; // Now includes role
}
