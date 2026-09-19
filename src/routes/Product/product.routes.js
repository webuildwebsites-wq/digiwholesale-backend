import express from "express";
import { createProduct, getProducts, getProductById, updateProduct, deleteProduct, deleteBulkProducts, addInventory, getInventoryByProductId, getProductsByCategory, filterProducts, suggestionProduct, getInventoryByProductCode, getDigiProductNames, bulkUploadProducts, getFrameSunglassProducts } from "../../core/controllers/Product/Product.controller.js";
import { searchLensProducts, getLensMatrixData, updateLensMatrix, getLensHistory } from "../../core/controllers/Product/lensMatrix.controller.js";
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
router.get("/names", checkPageAccess('INVENTORY'), getDigiProductNames);
router.get("/frames-sunglasses", checkPageAccess('INVENTORY'), getFrameSunglassProducts);
// Inventory by product code — must be before /inventory/:productId
router.get("/inventory/productCode/:productCode",checkPageAccess('INVENTORY'), getInventoryByProductCode);
// Inventory by product ID
router.get("/inventory/:productId", checkPageAccess('INVENTORY'), getInventoryByProductId);
// Get by category
router.get("/category/:category", checkPageAccess('INVENTORY'), getProductsByCategory);
// Lens Range Matrix & History routes — must be before /:id
router.get("/lens/search", checkPageAccess("INVENTORY"), searchLensProducts);
router.get("/lens/matrix-data", checkPageAccess("INVENTORY"), getLensMatrixData);
router.get("/lens/history", checkPageAccess("INVENTORY"), getLensHistory);
router.post("/lens/matrix-update", checkPermission("UPDATE_INVENTORY"), updateLensMatrix);

// Get single product — keep last among GET /:param routes
router.get("/:id", checkPageAccess('INVENTORY'), getProductById);


// Create product
router.post("/", checkPageAccess('INVENTORY'), digiupload.any(), createProduct);
// Add inventory
router.post("/add/inventory", checkPageAccess('INVENTORY'), addInventory);
// Filter products
router.post("/search", checkPageAccess('INVENTORY'), filterProducts);
router.post("/bulk", checkPermission("UPDATE_INVENTORY"), digiupload.any(), bulkUploadProducts);
router.post("/delete-bulk", checkPermission("UPDATE_INVENTORY"), deleteBulkProducts);

// Update product
router.put("/", checkPermission('UPDATE_INVENTORY'), digiupload.single("image"), updateProduct);

// Delete product
router.delete("/:id", checkPermission('UPDATE_INVENTORY'), deleteProduct);
export default router;