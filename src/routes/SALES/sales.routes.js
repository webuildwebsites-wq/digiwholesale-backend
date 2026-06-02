import express from "express";
import { createSale, getAllSales, getSaleById, updateSale, deleteSale, filterSales } from "../../core/controllers/SALES/sales.controller";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware";

const Salesrouter = express.Router();

Salesrouter.use(ProtectUser);

Salesrouter.post("/", createSale);

Salesrouter.get("/", getAllSales);

Salesrouter.get("/:id", getSaleById);

Salesrouter.put("/:id", updateSale);

Salesrouter.delete("/:id", deleteSale);

Salesrouter.post("/search", filterSales);

export default Salesrouter;