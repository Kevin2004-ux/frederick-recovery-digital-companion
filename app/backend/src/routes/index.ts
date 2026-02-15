// app/backend/src/routes/index.ts
import { Router } from "express";

import { healthRouter } from "./health.js";
import { authRouter } from "./auth/index.js";
import { userRouter } from "./user/index.js";
import { logRouter } from "./log/index.js";
import { activationRouter } from "./activation/index.js";
import { planRouter } from "./plan/index.js";
import { clinicRouter } from "./clinic/index.js";
import { adminRouter } from "./admin/index.js";

export const apiRouter = Router();

// NOTE: You already have app.get("/health") in app.ts.
// Keeping this is fine but redundant.
apiRouter.use("/health", healthRouter);

apiRouter.use("/auth", authRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/log", logRouter);

apiRouter.use("/activation", activationRouter);
apiRouter.use("/plan", planRouter);

apiRouter.use("/clinic", clinicRouter);
apiRouter.use("/admin", adminRouter);
