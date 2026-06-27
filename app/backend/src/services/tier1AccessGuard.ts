import { NextFunction, Request, Response } from "express";
import { ActivationCodeStatus, UserRole } from "@prisma/client";

import { prisma } from "../db/prisma.js";

export async function getClaimedActivationProductMode(userId: string) {
  const activation = await prisma.activationCode.findFirst({
    where: {
      claimedByUserId: userId,
      status: ActivationCodeStatus.CLAIMED,
    },
    orderBy: { claimedAt: "desc" },
    select: {
      productMode: true,
      batch: {
        select: {
          productMode: true,
        },
      },
    },
  });

  return activation?.productMode ?? activation?.batch?.productMode ?? null;
}

export function requireFullPlatformRecoveryAccess(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || user.role !== UserRole.PATIENT) {
      return next();
    }

    const productMode = await getClaimedActivationProductMode(user.id);

    if (productMode === "kit_only") {
      return res.status(403).json({
        code: "TIER_1_EDUCATION_ONLY",
        message: `${feature} is not included for kit-only recovery education.`,
      });
    }

    return next();
  };
}
