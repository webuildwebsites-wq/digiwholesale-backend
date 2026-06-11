import express from "express";
import { createVendor, getAllVendors, getVendorById, updateVendor, deleteVendor, filterVendors, suggestionVendors } from "../core/controllers/vendor.controller.js";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";

const router = express.Router();

// Create vendor
router.post("/", ProtectUser, createVendor);

// GET /api/vendor/suggestion?q=john  → search by name or mobile (max 5)
router.get("/suggestion", suggestionVendors);

// Get all vendors
router.get("/", getAllVendors);

// Get vendor by ID
router.get("/:_id", getVendorById);

// Update vendor
router.put("/:_id", ProtectUser, updateVendor);

// Delete vendor (ADMIN only)
router.delete("/:_id",ProtectUser, deleteVendor);

// fiter vendors by date range and keyword
router.post("/search", filterVendors);

export default router;

