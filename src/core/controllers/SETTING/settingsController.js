import Settings from "../../../models/SETTING/Settings.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

export const getSettingsByStore = async (req, res) => {
  try {
    const settings = await Settings.findOne({ tenantId: req.user.tenantId });

    if (!settings) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Settings data not found");
    }

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
      { new: true, runValidators: true }
    );

    if (!settings) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Settings not found");
    }

    return sendSuccessResponse(res, 200, { settings }, "Settings updated successfully");

  } catch (error) {
    console.error("Update Settings Data Error:", error);
    return sendErrorResponse(res, 500, "UPDATE_SETTINGS_ERROR", "Failed to update settings data");
  }
};
