import express from "express";
import { digiupload } from "../uploads/multer.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { createExchange, selectNewProduct, getAllExchanges, getExchangeById, updateExchangeStatus, updateExchange, deleteExchange, filterExchanges } from "../../core/controllers/SALES/exchange.controller.js";

const exchangeRouter = express.Router();

exchangeRouter.use(ProtectUser);

const upload = digiupload.fields([{ name: "photos", maxCount: 10 }]);

exchangeRouter.post("/", checkPermission("ADD_ORDER"), upload, createExchange);

exchangeRouter.get("/", checkPageAccess("EXCHANGE_REQUESTS"), getAllExchanges);

exchangeRouter.post("/search", checkPageAccess("EXCHANGE_REQUESTS"), filterExchanges);

exchangeRouter.get("/:id", checkPageAccess("EXCHANGE_REQUESTS"), getExchangeById);

exchangeRouter.patch("/:id/select-product", checkPermission("UPDATE_ORDER"), selectNewProduct);

exchangeRouter.put("/:id", checkPermission("UPDATE_ORDER"), updateExchange);

exchangeRouter.patch("/:id/status", checkPermission("UPDATE_ORDER"), updateExchangeStatus);

exchangeRouter.delete("/:id", checkPermission("DELETE_ORDER"), deleteExchange);

export default exchangeRouter;
