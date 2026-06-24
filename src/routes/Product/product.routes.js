import express from "express";
import { createProduct, getProducts, getProductById, updateProduct, deleteProduct, addInventory, getInventoryByProductId, getProductsByCategory, filterProducts, suggestionProduct, getInventoryByProductCode, getDigiProductNames } from "../../core/controllers/Product/Product.controller.js";
import { digiupload } from "../uploads/multer.js";
import { checkPageAccess, checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";

const router = express.Router();
router.use(ProtectUser);

// Get all products (pagination)
router.get("/", checkPageAccess('INVENTORY'), getProducts);
// Suggestions — must be before /:id to avoid route conflict
router.get("/suggestion", checkPageAccess('INVENTORY'), suggestionProduct);
// GET /api/digi/product/names?search=E&page=1&limit=100&brand=ZEISS&category=LENS
router.get("/names",checkPageAccess('INVENTORY'), getDigiProductNames);
// Inventory by product code — must be before /inventory/:productId
router.get("/inventory/productCode/:productCode",checkPageAccess('INVENTORY'), getInventoryByProductCode);
// Inventory by product ID
router.get("/inventory/:productId", checkPageAccess('INVENTORY'), getInventoryByProductId);
// Get by category
router.get("/category/:category", checkPageAccess('INVENTORY'), getProductsByCategory);
// Get single product — keep last among GET /:param routes
router.get("/:id", checkPageAccess('INVENTORY'), getProductById);


// Create product
router.post("/", checkPageAccess('INVENTORY'), digiupload.any(), createProduct);
// Add inventory
router.post("/add/inventory", checkPageAccess('INVENTORY'), addInventory);
// Filter products
router.post("/search", checkPageAccess('INVENTORY'), filterProducts);


// Update product
router.put("/", checkPermission('UPDATE_INVENTORY'), digiupload.single("image"), updateProduct);


// Delete product
router.delete("/:id", checkPermission('UPDATE_INVENTORY'), deleteProduct);
export default router;