import express from "express";
import { updateSettings, getSettingsByStore } from "../../core/controllers/SETTING/settingsController.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const settingRouter = express.Router();

settingRouter.use(ProtectUser);

settingRouter.get("/", getSettingsByStore);

settingRouter.put("/", checkPermission("UPDATE_INVENTORY"), updateSettings);

export default settingRouter;
