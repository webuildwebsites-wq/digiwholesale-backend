import express from "express";
// import { digiupload } from "../uploads/multer.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { createExchange, selectNewProduct, getAllExchanges, getExchangeById, updateExchangeStatus, updateExchange, deleteExchange, filterExchanges } from "../../core/controllers/SALES/exchange.controller.js";

const exchangeRouter = express.Router();

exchangeRouter.use(ProtectUser);

// const upload = digiupload.fields([{ name: "photos", maxCount: 10 }]);

exchangeRouter.post("/create",  createExchange);

exchangeRouter.get("/get-all-return-items", getAllExchanges);

exchangeRouter.post("/search", filterExchanges);

exchangeRouter.get("/:id", getExchangeById);

exchangeRouter.patch("/:id/select-product", selectNewProduct);

// exchangeRouter.put("/:id", updateExchange);

exchangeRouter.patch("/:id/status", updateExchangeStatus);

exchangeRouter.delete("/:id", deleteExchange);

export default exchangeRouter;
