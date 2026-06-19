import express from "express";
import { getOrder, listOrders, updateDraftOrder, cancelOrder, deleteOrder, getProductNames, getTintOptions, getFrameTypes, getProductBrands, getProductCategories, getProductTreatments, getProductIndexes, getProductTypes, getProductCoatings } from "../../core/controllers/order/order.controller.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { createBulkOrder, getBulkOrderChallan, getBulkOrderInvoice } from "../../core/controllers/order/bulkorder/bulkorder.js";

const orderRouter = express.Router();

orderRouter.use(ProtectUser);

// Product field dropdowns — all before /:id to avoid route conflicts
orderRouter.get("/product/get-tint", getTintOptions);
orderRouter.get("/product/get-frame-types", getFrameTypes);

orderRouter.get("/product-fields/brand", getProductBrands);
orderRouter.get("/product-fields/category", getProductCategories);

orderRouter.get("/product-fields/treatment", getProductTreatments);
orderRouter.get("/product-fields/index", getProductIndexes);
orderRouter.get("/product-fields/productType", getProductTypes);
orderRouter.get("/product-fields/coating", getProductCoatings);
orderRouter.get("/product-names", getProductNames);

orderRouter.post("/create-bulk-orders", createBulkOrder);
orderRouter.get("/bulk-orders/:orderId/challan", getBulkOrderChallan);


orderRouter.get("/bulk-orders/:orderId/invoice", getBulkOrderInvoice);


orderRouter.get("/get-all-orders", listOrders);

// /:id routes last
orderRouter.get("/:id", getOrder);
orderRouter.post("/:id/cancel", cancelOrder);
orderRouter.delete("/:id", deleteOrder);
orderRouter.patch("/:id/draft", updateDraftOrder);

export default orderRouter;
