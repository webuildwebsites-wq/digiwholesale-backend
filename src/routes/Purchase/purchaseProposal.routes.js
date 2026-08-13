import express from "express";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { checkPermission } from "../../middlewares/Auth/AdminMiddleware/rbac.middleware.js";
import {
    createPurchaseProposal,
    getAllPurchaseProposals,
    getPurchaseProposalById,
    submitVendorQuotation,
    finalizePurchaseProposal,
    cancelPurchaseProposal,
    resendProposalToVendor,
} from "../../core/controllers/Purchase/purchaseProposal.controller.js";

const purchaseProposalRouter = express.Router();

purchaseProposalRouter.use(ProtectUser);

purchaseProposalRouter.post("/create",                                          checkPermission("ADD_VENDOR"),    createPurchaseProposal);
purchaseProposalRouter.get("/get-all",                                          checkPermission("VIEW_REPORTS"),  getAllPurchaseProposals);
purchaseProposalRouter.get("/get-details/:id",                                  checkPermission("VIEW_REPORTS"),  getPurchaseProposalById);
purchaseProposalRouter.patch("/:id/quotation/:quotationId",                     checkPermission("UPDATE_VENDOR"), submitVendorQuotation);
purchaseProposalRouter.post("/:id/finalize",                                    checkPermission("ADD_VENDOR"),    finalizePurchaseProposal);
purchaseProposalRouter.patch("/:id/cancel",                                     checkPermission("UPDATE_VENDOR"), cancelPurchaseProposal);
purchaseProposalRouter.post("/:id/resend/:quotationId",                         checkPermission("UPDATE_VENDOR"), resendProposalToVendor);

export default purchaseProposalRouter;
