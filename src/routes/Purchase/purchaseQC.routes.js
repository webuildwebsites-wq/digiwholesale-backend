import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { createPurchaseQC, getAllPurchaseQCs, getPurchaseQCById, getQCFailedItemsReport } from "../../core/controllers/Purchase/purchaseQC.controller.js";

const purchaseQCRouter = express.Router();

purchaseQCRouter.use(ProtectUser);

purchaseQCRouter.post("/create", checkPermission("UPDATE_QUALITY"), createPurchaseQC);
purchaseQCRouter.get("/get-all-items", checkPermission("VIEW_REPORTS"), getAllPurchaseQCs);
purchaseQCRouter.get("/failed-report", checkPermission("VIEW_REPORTS"), getQCFailedItemsReport);
purchaseQCRouter.get("/:id", checkPermission("VIEW_REPORTS"), getPurchaseQCById);

export default purchaseQCRouter;
