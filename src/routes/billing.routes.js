import express from "express";
import mongoose from "mongoose";
import { ProtectUser } from "../middlewares/Auth/AdminMiddleware/adminMiddleware.js";
import { requireSubAdminOrHigher } from "../middlewares/Auth/AdminMiddleware/roleMiddleware.js";
import { sendDCBillingCycleChallan } from "../core/services/billing/billingNotification.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../Utils/response/responseHandler.js";
import Customer from "../models/Auth/Customer.js";
import BulkOrder from "../models/order/BulkOrder.js";
import { handleOrderBillingNotification } from "../core/services/billing/billingNotification.service.js";

const billingRouter = express.Router();

billingRouter.use(ProtectUser);
billingRouter.use(requireSubAdminOrHigher);

billingRouter.post("/send-billing-cycle-challan/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid customerId");
        }

        const customer = await Customer.findById(customerId).lean();
        if (!customer) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
        }

        if (customer.billingMode === "Direct") {
            const latestOrder = await BulkOrder.findOne({
                "customer.customerId": new mongoose.Types.ObjectId(customerId),
            }).sort({ createdAt: -1 }).lean();

            if (!latestOrder) {
                return sendErrorResponse(res, 404, "NO_ORDERS", "No orders found for this customer");
            }

            await handleOrderBillingNotification({ bulkOrder: latestOrder, customer });

            return sendSuccessResponse(res, 200, {
                billingMode: "Direct",
                orderNumber: latestOrder.orders[0]?.orderNumber,
                sentTo:      customer.businessEmail,
            }, "Invoice sent successfully for latest order");
        }

        if (customer.billingMode === "DC") {
            await sendDCBillingCycleChallan(customerId);

            return sendSuccessResponse(res, 200, {
                billingMode:  "DC",
                billingCycle: customer.billingCycle,
                sentTo:       customer.businessEmail,
            }, "Billing cycle challan sent successfully");
        }

        return sendErrorResponse(res, 400, "NO_BILLING_MODE", "Customer has no billing mode set (Direct or DC)");

    } catch (err) {
        return sendErrorResponse(res, 500, "BILLING_ERROR", err.message);
    }
});

export default billingRouter;
