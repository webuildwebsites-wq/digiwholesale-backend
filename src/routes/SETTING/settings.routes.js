import express from "express";
import { updateSettings, getSettingsByStore, getMyFeatureFlags } from "../../core/controllers/SETTING/settingsController.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const settingRouter = express.Router();

settingRouter.use(ProtectUser);

settingRouter.get("/", getSettingsByStore);

settingRouter.put("/", checkPermission("UPDATE_INVENTORY"), updateSettings);

// Read-only: any authenticated tenant user can fetch their own feature flags
settingRouter.get("/features", getMyFeatureFlags);

export default settingRouter;

