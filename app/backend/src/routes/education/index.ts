import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  AuditCategory,
  AuditService,
  AuditStatus,
} from "../../services/AuditService.js";
import { EducationService } from "../../services/educationService.js";

export const educationRouter = Router();

educationRouter.use(requireAuth);
educationRouter.use(
  requireRole([UserRole.PATIENT, UserRole.CLINIC, UserRole.OWNER])
);

const educationSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Query must be at least 2 characters"),
});

educationRouter.get("/search", async (req, res) => {
  const parsedQuery = educationSearchQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res
      .status(400)
      .json({ code: "VALIDATION_ERROR", issues: parsedQuery.error.issues });
  }

  const query = parsedQuery.data.q;
  const user = req.user!;

  try {
    const result = await EducationService.search(query);

    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "EDUCATION_SEARCHED",
      status: AuditStatus.SUCCESS,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        query,
        resultCount: result.articles.length,
        cached: result.cached,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Education search failed", error);

    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "EDUCATION_SEARCH_FAILED",
      status: AuditStatus.FAILURE,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        query,
      },
    });

    return res.status(500).json({
      code: "EDUCATION_SEARCH_FAILED",
      message: "Failed to load education articles",
    });
  }
});
