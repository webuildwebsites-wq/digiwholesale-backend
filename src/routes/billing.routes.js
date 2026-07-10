import express from "express";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { requireSubAdminOrHigher } from "../middlewares/Auth/AdminMiddleware/roleMiddleware.js";
import { sendDCBillingCycleChallan } from "../core/services/billing/billingNotification.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../Utils/response/responseHandler.js";
import mongoose from "mongoose";

const billingRouter = express.Router();

billingRouter.use(ProtectUser);
billingRouter.use(requireSubAdminOrHigher);

billingRouter.post("/send-billing-cycle-challan/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid customerId");
        }

        await sendDCBillingCycleChallan(customerId);

        return sendSuccessResponse(res, 200, null, "Billing cycle challan sent successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "BILLING_CHALLAN_ERROR", err.message);
    }
});

export default billingRouter;
