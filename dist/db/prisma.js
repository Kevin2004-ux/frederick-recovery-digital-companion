import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.APP_ENV === "development" ? ["error", "warn"] : ["error"],
    });
if (process.env.APP_ENV === "development") {
    globalForPrisma.prisma = prisma;
}
