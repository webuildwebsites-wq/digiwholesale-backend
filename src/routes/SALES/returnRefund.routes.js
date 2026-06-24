import express from "express";
import { digiupload } from "../uploads/multer.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { createReturnRefund, getAllReturnRefunds, getReturnRefundById, updateReturnRefundStatus, updateReturnRefund, deleteReturnRefund, filterReturnRefunds } from "../../core/controllers/SALES/returnRefund.controller.js";

const returnRefundRouter = express.Router();

returnRefundRouter.use(ProtectUser);

const upload = digiupload.fields([
  { name: "photos", maxCount: 10 },
  { name: "giftVoucher", maxCount: 1 },
]);

returnRefundRouter.post("/", checkPermission("ADD_ORDER"), upload, createReturnRefund);

returnRefundRouter.get("/", checkPageAccess("RETURN_REFUND"), getAllReturnRefunds);

returnRefundRouter.post("/search", checkPageAccess("RETURN_REFUND"), filterReturnRefunds);

returnRefundRouter.get("/:id", checkPageAccess("RETURN_REFUND"), getReturnRefundById);

returnRefundRouter.put("/:id", checkPermission("UPDATE_ORDER"), updateReturnRefund);

returnRefundRouter.patch("/:id/status", checkPermission("UPDATE_ORDER"), updateReturnRefundStatus);

returnRefundRouter.delete("/:id", checkPermission("DELETE_ORDER"), deleteReturnRefund);

export default returnRefundRouter;
