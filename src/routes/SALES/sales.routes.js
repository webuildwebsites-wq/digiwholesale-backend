import express from "express";
import { createSale, getAllSales, getSaleById, updateSale, deleteSale, filterSales } from "../../core/controllers/SALES/sales.controller.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPageAccess, checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";

const Salesrouter = express.Router();

Salesrouter.use(ProtectUser);

Salesrouter.post("/", checkPermission("ADD_ORDER"), createSale);

Salesrouter.get("/", checkPageAccess("SALES_LIST"), getAllSales);

Salesrouter.get("/:id", checkPageAccess("SALES_LIST"), getSaleById);

Salesrouter.put("/:id", checkPermission("UPDATE_ORDER"), updateSale);

Salesrouter.delete("/:id", checkPermission("DELETE_ORDER"), deleteSale);

Salesrouter.post("/search", checkPageAccess("SALES_LIST"), filterSales);

export default Salesrouter;
