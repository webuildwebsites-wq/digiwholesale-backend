import express from "express";
import {
  updateSettings,
  getSettingsByStore,
} from "../../core/controllers/SETTING/settingsController.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware";

const settingRouter = express.Router();
settingRouter(ProtectUser)

settingRouter.use(isLoggedIn);

settingRouter.get("/", getSettingsByStore);

settingRouter.put("/",  updateSettings);

export default settingRouter;