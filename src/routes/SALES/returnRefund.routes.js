import express from "express";
import { digiupload } from "../uploads/multer.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import {
  createReturnRefund,
  getAllReturnRefunds,
  getReturnRefundById,
  updateReturnRefundStatus,
  updateReturnRefund,
  deleteReturnRefund,
  filterReturnRefunds,
} from "../../core/controllers/SALES/returnRefund.controller.js";

const returnRefundRouter = express.Router();

returnRefundRouter.use(ProtectUser);

// photos (max 10) + optional giftVoucher (1)
const upload = digiupload.fields([
  { name: "photos", maxCount: 10 },
  { name: "giftVoucher", maxCount: 1 },
]);

// Create
returnRefundRouter.post("/", upload, createReturnRefund);

// Get all (paginated) — optional ?status=Pending&page=1&limit=20
returnRefundRouter.get("/", getAllReturnRefunds);

// Filter / search
returnRefundRouter.post("/search", filterReturnRefunds);

// Get single
returnRefundRouter.get("/:id", getReturnRefundById);

// Update full record
returnRefundRouter.put("/:id", updateReturnRefund);

// Update status only
returnRefundRouter.patch("/:id/status", updateReturnRefundStatus);

// Delete
returnRefundRouter.delete("/:id", deleteReturnRefund);

export default returnRefundRouter;
