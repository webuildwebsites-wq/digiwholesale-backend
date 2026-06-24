import express from "express";
import { createVendorOrder, getVendorOrderById, updateVendorOrderStatus, getVendorOrders, deleteVendorOrder, updateVendorOrderIssues, filterVendorsOrders, suggestionVendorOrder } from "../core/controllers/vendorOrder.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const router = express.Router();

router.use(ProtectUser);

router.post("/", checkPermission("ADD_VENDOR"), createVendorOrder);

router.get("/suggestion", suggestionVendorOrder);

router.get("/", checkPageAccess("VENDOR_ORDER"), getVendorOrders);

router.get("/:_id", checkPageAccess("VENDOR_ORDER"), getVendorOrderById);

router.put("/:_id/status", checkPermission("UPDATE_VENDOR"), updateVendorOrderStatus);

router.delete("/:_id", checkPermission("DELETE_VENDOR"), deleteVendorOrder);

router.put("/issues/:_id", checkPermission("UPDATE_VENDOR"), updateVendorOrderIssues);

router.post("/search", filterVendorsOrders);

export default router;
