import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { createPurchaseInward, getAllPurchaseInwards, getPurchaseInwardById } from "../../core/controllers/Purchase/purchaseInward.controller.js";

const purchaseInwardRouter = express.Router();

purchaseInwardRouter.use(ProtectUser);

purchaseInwardRouter.post("/create", createPurchaseInward);
purchaseInwardRouter.get("/get-all-items", getAllPurchaseInwards);
purchaseInwardRouter.get("/:id", getPurchaseInwardById);

export default purchaseInwardRouter;
