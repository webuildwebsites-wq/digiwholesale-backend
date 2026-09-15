import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { getBatchesForProduct, getAllBatches, getBatchById, allocateManualBatch } from "../../core/controllers/Product/batch.controller.js";

const batchRouter = express.Router();

batchRouter.use(ProtectUser);

batchRouter.get("/",                   checkPermission("VIEW_INVENTORY"), getAllBatches);
batchRouter.get("/product/:productId", checkPermission("VIEW_INVENTORY"), getBatchesForProduct);
batchRouter.post("/allocate",          checkPermission("UPDATE_INVENTORY"), allocateManualBatch);
batchRouter.get("/:batchId",           checkPermission("VIEW_INVENTORY"), getBatchById);

export default batchRouter;
