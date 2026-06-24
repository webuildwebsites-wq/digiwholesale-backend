import express from "express";
import { getDashboardAnalytics } from "../core/controllers/analytics.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess } from "../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const analyticsRouter = express.Router();

analyticsRouter.use(ProtectUser);

analyticsRouter.get("/dashboard", checkPageAccess("DASHBOARD"), getDashboardAnalytics);

export default analyticsRouter;
