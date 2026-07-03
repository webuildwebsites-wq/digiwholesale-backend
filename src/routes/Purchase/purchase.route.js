import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { createVendorPurchaseItems, getAllPurchaseItems, getVendorPurchaseItemsById, deleteVendorPurchaseItems, updateVendorPurchaseItems, getOrdersByVendorId, updateVendorRefId } from "../../core/controllers/Purchase/purchase.controller.js";

const purchaseRouter = express.Router();

purchaseRouter.use(ProtectUser);

purchaseRouter.get("/get-all-purchase-items", getAllPurchaseItems);

purchaseRouter.get("/vendor-orders/:vendorId", getOrdersByVendorId);

purchaseRouter.get("/get-purchase-items-details/:id", getVendorPurchaseItemsById);

purchaseRouter.post("/create-vendor-purchase-items", createVendorPurchaseItems);

purchaseRouter.delete("/delete-vendor-purchase-items/:id", deleteVendorPurchaseItems);

purchaseRouter.patch("/update-vendor-purchase-items/:id", updateVendorPurchaseItems);

purchaseRouter.patch("/:id/vendor-ref-id", updateVendorRefId);

export default purchaseRouter;