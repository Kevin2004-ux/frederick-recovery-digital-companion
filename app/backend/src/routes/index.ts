// app/backend/src/routes/index.ts
import { Router } from "express";
import { healthRouter } from "./health.js";
import { authRouter } from "./auth/index.js";
import { userRouter } from "./user/index.js";
import { logRouter } from "./log/index.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/log", logRouter);
