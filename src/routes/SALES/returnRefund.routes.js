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

const uploadOptional = (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return upload(req, res, next);
  }
  next();
};

returnRefundRouter.post("/create", uploadOptional, createReturnRefund);

returnRefundRouter.get("/get-all-return-items",  getAllReturnRefunds);

returnRefundRouter.post("/search",  filterReturnRefunds);

returnRefundRouter.get("/:id",  getReturnRefundById);

// returnRefundRouter.put("/:id", updateReturnRefund);

returnRefundRouter.patch("/:id/status", updateReturnRefundStatus);

returnRefundRouter.delete("/:id", deleteReturnRefund);

export default returnRefundRouter;
