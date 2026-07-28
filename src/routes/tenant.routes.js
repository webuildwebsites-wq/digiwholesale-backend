import express from "express";
import {
    registerTenant,
    getAllTenants,
    getTenantById,
    updateTenant,
    suspendTenant,
    activateTenant,
    deleteTenant,
} from "../core/controllers/Tenant/platformOwner.controller.js";
import { protectPlatformOwner } from "../middlewares/Auth/AdminMiddleware/platformOwnerMiddleware.js";

const tenantRouter = express.Router();

tenantRouter.use(protectPlatformOwner);

tenantRouter.post("/register",      registerTenant);
tenantRouter.get("/",               getAllTenants);
tenantRouter.get("/:id",            getTenantById);
tenantRouter.put("/:id",            updateTenant);
tenantRouter.patch("/:id/suspend",  suspendTenant);
tenantRouter.patch("/:id/activate", activateTenant);
tenantRouter.delete("/:id",         deleteTenant);

export default tenantRouter;
