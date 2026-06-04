import express from "express";
import { digiupload } from "../uploads/multer.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import {
  createExchange,
  selectNewProduct,
  getAllExchanges,
  getExchangeById,
  updateExchangeStatus,
  updateExchange,
  deleteExchange,
  filterExchanges,
} from "../../core/controllers/SALES/exchange.controller.js";

const exchangeRouter = express.Router();

exchangeRouter.use(ProtectUser);

// photos only for exchange (max 10)
const upload = digiupload.fields([{ name: "photos", maxCount: 10 }]);

// Create exchange request
exchangeRouter.post("/", upload, createExchange);

// Get all (paginated) — optional ?status=Pending&page=1&limit=20
exchangeRouter.get("/", getAllExchanges);

// Filter / search
exchangeRouter.post("/search", filterExchanges);

// Get single
exchangeRouter.get("/:id", getExchangeById);

// Attach / update selected new product  ("Select Product" step)
exchangeRouter.patch("/:id/select-product", selectNewProduct);

// Update full record (only if Pending)
exchangeRouter.put("/:id", updateExchange);

// Update status only
exchangeRouter.patch("/:id/status", updateExchangeStatus);

// Delete
exchangeRouter.delete("/:id", deleteExchange);

export default exchangeRouter;
