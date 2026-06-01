import { getDashboardAnalyticsService } from "../services/analytics.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../Utils/response/responseHandler.js";

function handleError(res, err) {
  console.error("[Analytics]", err?.message || err);
  if (err?.statusCode) {
    return sendErrorResponse(res, err.statusCode, err.code, err.message);
  }
  return sendErrorResponse(res, 500, "INTERNAL_ERROR", err?.message || "Unexpected error");
}

/**
 * GET /api/analytics/dashboard
 * Returns dashboard analytics:
 *  - activeUsers, pendingOrders, completedOrders
 *  - dailyOrders, weeklyOrders, monthlyOrders
 *  - totalStaff
 *  - orderStatusBreakdown
 *  - recentOrders (last 5)
 */
export const getDashboardAnalytics = async (req, res) => {
  try {
    const data = await getDashboardAnalyticsService();
    return sendSuccessResponse(res, 200, data, "Dashboard analytics retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};
