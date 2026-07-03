import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { createPurchaseQC, getAllPurchaseQCs, getPurchaseQCById } from "../../core/controllers/Purchase/purchaseQC.controller.js";

const purchaseQCRouter = express.Router();

purchaseQCRouter.use(ProtectUser);

purchaseQCRouter.post("/create",  createPurchaseQC);
purchaseQCRouter.get("/get-all-items",  getAllPurchaseQCs);
purchaseQCRouter.get("/:id",  getPurchaseQCById);

export default purchaseQCRouter;
