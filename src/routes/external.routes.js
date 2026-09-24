import express from "express";
import { validateExternalApiKey } from "../middlewares/externalApiKey.middleware.js";
import { ProtectUser }            from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import {
  getAllActiveWholesalers,
  receiveExternalOrder,
  getExternalOrderStatus,
  getIncomingOrdersForWholesaler,
  updateExternalOrderStatus,
} from "../core/controllers/external.controller.js";

const router = express.Router();

// ─── Public External Routes (protected by API key only) ───────────────────────

// GET → list active wholesalers (for dropdown)
router.get("/wholesalers", validateExternalApiKey, getAllActiveWholesalers);
// POST → receive order from Digi-Retailer
router.post("/orders", validateExternalApiKey, receiveExternalOrder);
// GET → check order status (Retailer tracks order)
router.get("/orders/:orderNumber", validateExternalApiKey, getExternalOrderStatus);




// ─── Internal Routes (protected by normal JWT) ────────

// GET  → list incoming retailer orders in wholesaler panel
router.get("/internal/orders", ProtectUser, getIncomingOrdersForWholesaler);
// PUT  → wholesaler updates order status
router.put("/internal/orders/:id/status", ProtectUser, updateExternalOrderStatus);

export default router;
