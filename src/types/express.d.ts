// app/backend/src/types/express.d.ts
export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: "PATIENT" | "CLINIC";
        clinicTag: string | null;
      };
    }
  }
}
