import express from "express";
import { getDashboardAnalytics } from "../core/controllers/analytics.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";

const analyticsRouter = express.Router();

analyticsRouter.use(ProtectUser);

analyticsRouter.get("/dashboard", getDashboardAnalytics);

export default analyticsRouter;
