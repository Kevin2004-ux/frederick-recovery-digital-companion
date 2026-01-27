// app/backend/src/routes/log/index.ts
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireConsent } from "../../middleware/requireConsent.js";
import { requireOnboarding } from "../../middleware/requireOnboarding.js";

export const logRouter = Router();

logRouter.use(requireAuth);
logRouter.use(requireConsent);
logRouter.use(requireOnboarding);

logRouter.get("/", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Log access granted",
    userId: req.user!.id,
  });
});
