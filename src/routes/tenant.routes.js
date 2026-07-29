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


tenantRouter.post("/register", protectPlatformOwner, registerTenant);
tenantRouter.get("/", protectPlatformOwner, getAllTenants);
tenantRouter.get("/:id", getTenantById);
tenantRouter.put("/:id", protectPlatformOwner, updateTenant);
tenantRouter.patch("/:id/suspend", protectPlatformOwner, suspendTenant);
tenantRouter.patch("/:id/activate", protectPlatformOwner, activateTenant);
tenantRouter.delete("/:id", protectPlatformOwner, deleteTenant);

export default tenantRouter;
