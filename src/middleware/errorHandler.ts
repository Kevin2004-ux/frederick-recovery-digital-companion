// app/backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Centralized Error Handler
 * Catches all errors thrown in routes/controllers
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // 1. Log the error for debugging (exclude 404s/401s if you want cleaner logs)
  console.error(`[ERROR] ${req.method} ${req.path}`, err);

  // 2. Handle Zod Validation Errors (Input Validation)
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: err.errors, // returns detailed field-level issues
    });
  }

  // 3. Handle Known App Logic Errors
  // These matches the strings thrown in userRepo.ts
  if (err.message === "EMAIL_TAKEN") {
    return res.status(409).json({ code: "EMAIL_ALREADY_EXISTS" });
  }
  if (err.message === "USER_NOT_FOUND") {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }
  if (err.message === "INVALID_CREDENTIALS") {
    return res.status(401).json({ code: "INVALID_CREDENTIALS" });
  }
  if (err.message === "NO_PLAN_TEMPLATE") {
    return res.status(500).json({ code: "NO_PLAN_TEMPLATE", message: "Configuration Error: No template found." });
  }
  
  // 4. Handle JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ code: "INVALID_TOKEN" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ code: "TOKEN_EXPIRED" });
  }

  // 5. Handle Prisma Database Errors
  // P2002 = Unique constraint failed
  if (err.code === "P2002") {
    return res.status(409).json({ code: "CONFLICT", message: "Unique constraint violation" });
  }
  // P2025 = Record not found (when using findUniqueOrThrow)
  if (err.code === "P2025") {
    return res.status(404).json({ code: "NOT_FOUND" });
  }

  // 6. Fallback: Internal Server Error
  // Don't leak stack traces to the client in production
  res.status(500).json({ 
    code: "INTERNAL_SERVER_ERROR", 
    message: "Something went wrong." 
  });
}