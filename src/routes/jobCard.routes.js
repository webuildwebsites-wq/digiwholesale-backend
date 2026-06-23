import express from "express";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { getDailyReportData, getMainReportData } from "../core/controllers/jobCard.controller.js";
import { checkPageAccess, checkPermission } from "../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const router = express.Router();

router.post("/report/main", ProtectUser, checkPageAccess("MAIN_REPORT"), checkPermission("VIEW_REPORTS"), getMainReportData);

router.post("/report/daily", ProtectUser, checkPageAccess("DAILY_REPORT"), checkPermission("VIEW_REPORTS"), getDailyReportData);

export default router;
