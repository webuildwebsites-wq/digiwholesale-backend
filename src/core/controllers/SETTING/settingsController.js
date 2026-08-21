import Settings from "../../../models/SETTING/Settings.js";
import Tenant   from "../../../models/Tenant/Tenant.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

export const getSettingsByStore = async (req, res) => {
  try {
    const settings = await Settings.find({}).lean();
    return sendSuccessResponse(res, 200, { settings });

  } catch (error) {
    console.error("Get Settings Data Error:", error);
    return sendErrorResponse(res, 500, "GET_SETTINGS_ERROR", "Failed to fetch settings data");
  }
};

export const updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    return sendSuccessResponse(res, 200, { settings }, "Settings updated successfully");

  } catch (error) {
    console.error("Update Settings Data Error:", error);
    return sendErrorResponse(res, 500, "UPDATE_SETTINGS_ERROR", "Failed to update settings data");
  }
};

/**
 * GET /api/settings/features
 * Returns the featureFlags for the requesting user's own tenant.
 * Read-only — any authenticated user of the tenant can call this.
 */
export const getMyFeatureFlags = async (req, res) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return sendErrorResponse(res, 400, "NO_TENANT", "User is not associated with a tenant");
    }

    const tenant = await Tenant.findOne({ tenantId }).select("featureFlags").lean();

    if (!tenant) {
      return sendErrorResponse(res, 404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    const featureFlags = tenant.featureFlags || {};

    return sendSuccessResponse(res, 200, { featureFlags }, "Feature flags retrieved successfully");

  } catch (error) {
    console.error("Get Feature Flags Error:", error);
    return sendErrorResponse(res, 500, "GET_FEATURE_FLAGS_ERROR", "Failed to fetch feature flags");
  }
};

