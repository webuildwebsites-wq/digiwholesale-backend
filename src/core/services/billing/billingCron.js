import Customer from "../../../models/Auth/Customer.js";
import { sendDCBillingCycleChallan } from "./billingNotification.service.js";

const getDayOfMonth = () => new Date().getDate();
const getDayOfWeek  = () => new Date().getDay();

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

        const today       = getDayOfMonth();
        const dayOfWeek   = getDayOfWeek();
        const isMonday    = dayOfWeek === 1;
        const isLastDay   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() === today;

        const promises = [];

        for (const customer of dcCustomers) {
            const cycle = customer.billingCycle;

            const shouldSend =
                (cycle === "7_days"      && isMonday)  ||
                (cycle === "15_days"     && (today === 1 || today === 16)) ||
                (cycle === "end_of_month"&& isLastDay);

            if (shouldSend) {
                console.log(`[BillingCron] Sending challan for customer: ${customer.shopName} (cycle: ${cycle})`);
                promises.push(
                    sendDCBillingCycleChallan(customer._id.toString())
                        .catch(err => console.error(`[BillingCron] Error for customer ${customer._id}:`, err.message))
                );
            }
        }

        if (promises.length === 0) {
            console.log("[BillingCron] No customers due for challan today");
            return;
        }

        await Promise.all(promises);
        console.log(`[BillingCron] Completed. Sent challans to ${promises.length} customer(s)`);

    } catch (err) {
        console.error("[BillingCron] Fatal error:", err.message);
    }
};

export const startBillingCron = () => {
    const INTERVAL_MS = 60 * 60 * 1000;

    runBillingCycleCron();

    setInterval(runBillingCycleCron, INTERVAL_MS);

    console.log("[BillingCron] Scheduled — runs every hour, triggers based on billing cycle");
};
