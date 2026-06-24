import express from "express";
import { createVendor, getAllVendors, getVendorById, updateVendor, deleteVendor, filterVendors, suggestionVendors } from "../core/controllers/vendor.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const router = express.Router();

router.use(ProtectUser);

router.post("/", checkPermission("ADD_VENDOR"), createVendor);

router.get("/suggestion", suggestionVendors);

router.get("/", checkPageAccess("VENDOR_LIST"), getAllVendors);

router.get("/:_id", checkPageAccess("VENDOR_LIST"), getVendorById);

router.put("/:_id", checkPermission("UPDATE_VENDOR"), updateVendor);

router.delete("/:_id", checkPermission("DELETE_VENDOR"), deleteVendor);

router.post("/search", filterVendors);

export default router;
