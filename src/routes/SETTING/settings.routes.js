import express from "express";
import {
  updateSettings,
  getSettingsByStore,
} from "../../core/controllers/SETTING/settingsController.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";

const settingRouter = express.Router();

settingRouter.use(ProtectUser);

settingRouter.get("/", getSettingsByStore);

settingRouter.put("/",  updateSettings);

export default settingRouter;