import Customer from "../../../models/Auth/Customer.js";
import { sendDCBillingCycleChallan } from "./billingNotification.service.js";

export const runBillingCycleCron = async () => {
    try {
        console.log(`[BillingCron] Running at ${new Date().toISOString()}`);

        const dcCustomers = await Customer.find({
            billingMode: "DC",
            billingCycle: { $exists: true, $ne: null },
            "status.isActive": true,
            isDeleted: false,
        }).lean();

        if (!dcCustomers.length) {
            console.log("[BillingCron] No DC customers found");
            return;
        }

        const promises = [];

        for (const customer of dcCustomers) {
            console.log(
                `[BillingCron] Sending challan for ${customer.shopName} (${customer.billingCycle})`
            );

            promises.push(
                sendDCBillingCycleChallan(customer._id.toString()).catch((err) =>
                    console.error(
                        `[BillingCron] Error for ${customer.shopName}:`,
                        err.message
                    )
                )
            );
        }

        await Promise.all(promises);

        console.log(
            `[BillingCron] Completed. Sent challans to ${promises.length} customer(s)`
        );
    } catch (err) {
        console.error("[BillingCron] Fatal error:", err.message);
    }
};

export const testStartBillingCron = async () => {
    try {
        console.log("[BillingCron] Scheduling one-time jobs...");

        const dcCustomers = await Customer.find({
            billingMode: "DC",
            billingCycle: { $exists: true, $ne: null },
            "status.isActive": true,
            isDeleted: false,
        }).lean();

        if (!dcCustomers.length) {
            console.log("[BillingCron] No DC customers found");
            return;
        }

        for (const customer of dcCustomers) {
            let delay = 0;

            switch (customer.billingCycle) {
                case "7_days":
                    delay = 1 * 60 * 1000; // 1 minute
                    break;

                case "15_days":
                    delay = 2 * 60 * 1000; // 2 minutes
                    break;

                case "end_of_month":
                    delay = 3 * 60 * 1000; // 3 minutes
                    break;

                default:
                    continue;
            }

            console.log(
                `[BillingCron] ${customer.shopName} scheduled in ${delay / 60000} minute(s)`
            );

            setTimeout(async () => {
                try {
                    console.log(
                        `[BillingCron] Sending challan to ${customer.shopName}`
                    );

                    await sendDCBillingCycleChallan(customer._id.toString());

                    console.log(
                        `[BillingCron] Challan sent to ${customer.shopName}`
                    );
                } catch (err) {
                    console.error(
                        `[BillingCron] Error for ${customer.shopName}:`,
                        err.message
                    );
                }
            }, delay);
        }
    } catch (err) {
        console.error("[BillingCron] Fatal error:", err.message);
    }
};