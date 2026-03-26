// Legacy Prisma entrypoint.
// Do not use for new runtime code; prefer src/db/prisma.ts.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
