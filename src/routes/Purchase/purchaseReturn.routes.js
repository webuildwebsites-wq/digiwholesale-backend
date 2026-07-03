import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { getAllPurchaseReturns, getPurchaseReturnById, updatePurchaseReturnStatus } from "../../core/controllers/Purchase/purchaseReturn.controller.js";

const purchaseReturnRouter = express.Router();

purchaseReturnRouter.use(ProtectUser);

purchaseReturnRouter.get("/get-all-items",  getAllPurchaseReturns);
purchaseReturnRouter.get("/:id",  getPurchaseReturnById);
purchaseReturnRouter.patch("/:id/status", updatePurchaseReturnStatus);

export default purchaseReturnRouter;
