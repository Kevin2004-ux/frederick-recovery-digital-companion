// app/backend/src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email?: string;
    };
  }
}

export {};
