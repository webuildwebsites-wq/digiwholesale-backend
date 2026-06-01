import express from "express";
import { getDashboardAnalytics } from "../core/controllers/analytics.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";

const analyticsRouter = express.Router();

// All analytics routes require a valid employee/admin token
analyticsRouter.use(ProtectUser);

/**
 * GET /api/analytics/dashboard
 * Dashboard summary: active users, orders (pending/completed/daily/weekly/monthly),
 * total staff, order status breakdown, recent orders.
 */
analyticsRouter.get("/dashboard", getDashboardAnalytics);

export default analyticsRouter;
