import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { getAllPurchaseReturns, getPurchaseReturnById, updateItemStatus, getShrinkageItems, getDamagedItems } from "../../core/controllers/Purchase/purchaseReturn.controller.js";

const purchaseReturnRouter = express.Router();

purchaseReturnRouter.use(ProtectUser);

purchaseReturnRouter.get("/get-all-items",      getAllPurchaseReturns);
purchaseReturnRouter.get("/shrinkage-items",    getShrinkageItems);
purchaseReturnRouter.get("/damaged-items",      getDamagedItems);
purchaseReturnRouter.get("/:id",                getPurchaseReturnById);
purchaseReturnRouter.patch("/:id/items-status", updateItemStatus);

export default purchaseReturnRouter;
