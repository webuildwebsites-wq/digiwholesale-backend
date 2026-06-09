import express from "express";
import { createProduct, getProducts, getProductById, updateProduct, deleteProduct, addInventory, getInventoryByProductId, getProductsByCategory, filterProducts, suggestionProduct, getInventoryByProductCode, getDigiProductNames } from "../../core/controllers/Product/Product.controller.js";
import { digiupload } from "../uploads/multer.js";

const router = express.Router();

// Get all products (pagination)
router.get("/", getProducts);
// Suggestions — must be before /:id to avoid route conflict
router.get("/suggestion", suggestionProduct);
// GET /api/digi/product/names?search=E&page=1&limit=100&brand=ZEISS&category=LENS
router.get("/names", getDigiProductNames);
// Inventory by product code — must be before /inventory/:productId
router.get("/inventory/productCode/:productCode", getInventoryByProductCode);
// Inventory by product ID
router.get("/inventory/:productId", getInventoryByProductId);
// Get by category
router.get("/category/:category", getProductsByCategory);
// Get single product — keep last among GET /:param routes
router.get("/:id", getProductById);


// Create product
router.post("/", digiupload.any(), createProduct);
// Add inventory
router.post("/add/inventory", addInventory);
// Filter products
router.post("/search", filterProducts);


// Update product
router.put("/", digiupload.single("image"), updateProduct);


// Delete product
router.delete("/:id", deleteProduct);
export default router;