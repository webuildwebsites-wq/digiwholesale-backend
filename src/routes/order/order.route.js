import express from "express";
import { getOrder, listOrders, updateDraftOrder, cancelOrder, deleteOrder, getProductNames, getTintOptions, getFrameTypes, getProductBrands, getProductCategories, getProductTreatments, getProductIndexes, getProductCoatings, suggestionsOrders } from "../../core/controllers/order/order.controller.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { createBulkOrder, getBulkOrderChallan, getBulkOrderInvoice } from "../../core/controllers/order/bulkorder/bulkorder.js";
import { checkPageAccess, checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const orderRouter = express.Router();

orderRouter.use(ProtectUser);

orderRouter.get("/product/get-tint", getTintOptions);
orderRouter.get("/product/get-frame-types", getFrameTypes);
orderRouter.get("/product-fields/brand", getProductBrands);
orderRouter.get("/product-fields/category", getProductCategories);
orderRouter.get("/product-fields/treatment", getProductTreatments);
orderRouter.get("/product-fields/index", getProductIndexes);
// orderRouter.get("/product-fields/productType", getProductTypes);
orderRouter.get("/product-fields/coating", getProductCoatings);
orderRouter.get("/product-names", getProductNames);

orderRouter.post("/create-bulk-orders", checkPermission("ADD_ORDER"), createBulkOrder);
orderRouter.get("/bulk-orders/:orderId/challan", checkPageAccess("ALL_ORDERS"), getBulkOrderChallan);
orderRouter.get("/bulk-orders/:orderId/invoice", checkPageAccess("ALL_ORDERS"), getBulkOrderInvoice);

orderRouter.get("/get-all-orders", checkPageAccess("ALL_ORDERS"), listOrders);
orderRouter.get("/suggestions", checkPageAccess("ALL_ORDERS"), suggestionsOrders);

orderRouter.get("/:id", checkPageAccess("ALL_ORDERS"), getOrder);
orderRouter.post("/:id/cancel", checkPermission("UPDATE_ORDER"), cancelOrder);
orderRouter.delete("/:id", checkPermission("DELETE_ORDER"), deleteOrder);
orderRouter.patch("/:id/draft", checkPermission("UPDATE_DRAFT"), updateDraftOrder);

export default orderRouter;
