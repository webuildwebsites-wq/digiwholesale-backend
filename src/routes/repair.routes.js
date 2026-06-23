import express from "express";
import { createRepair, deleteRepair, getSingleRepair, updateRepair, updateRepairStatus, filterRepairs, getRepairs } from "../core/controllers/repair.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { digiupload } from "./uploads/multer.js";

const router = express.Router();

router.use(ProtectUser);

router.post("/", checkPermission("ADD_REPAIR"), digiupload.array("images", 10), createRepair);

router.post("/search", filterRepairs);

router.get("/", checkPageAccess("REPAIR_LIST"), getRepairs);

router.get("/:_id", checkPageAccess("REPAIR_LIST"), getSingleRepair);

router.put("/:_id", checkPermission("UPDATE_REPAIR"), updateRepair);

router.patch("/:_id/status", checkPermission("UPDATE_REPAIR"), updateRepairStatus);

router.delete("/:_id", checkPermission("DELETE_REPAIR"), deleteRepair);

export default router;
