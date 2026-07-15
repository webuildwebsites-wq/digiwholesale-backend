import mongoose from "mongoose";
import dotenv from "dotenv";
import Customer from "../src/models/Auth/Customer.js";

dotenv.config();

const connectDB = async () => {
    try {
        await  mongoose.connect(process.env.MONGODB_URL || "mongodb+srv://digitalsolutions_db_user:o1rNKhidNpz5K8IO@digiopticsmanufacture.iuilxjp.mongodb.net/digioptics-wholeseller?retryWrites=true&w=majority");

        console.log("✅ MongoDB Connected");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        process.exit(1);
    }
};

const getDCBillingCustomers = async () => {
    try {
        const customers = await Customer.find({
            billingMode: "DC",
            billingCycle: {
                $in: ["7_days", "15_days", "end_of_month"],
            },
            "status.isActive": true,
            isDeleted: false,
        }).select("_id shopName mobileNo1 businessEmail billingCycle").lean();

        if (!customers.length) {
            console.log("⚠️ No DC Billing customers found.");
            return;
        }

        const result = customers.map((customer, index) => ({
            SrNo: index + 1,
            CustomerID: customer._id.toString(),
            ShopName: customer.shopName,
            WhatsApp: customer.mobileNo1,
            Email: customer.businessEmail,
            BillingCycle: customer.billingCycle,
        }));

        console.log(`\nTotal Customers: ${result.length}\n`);

        console.table(result);
    } catch (error) {
        console.error("❌ Error fetching customers:", error);
    }
};

(async () => {
    await connectDB();

    await getDCBillingCustomers();

    await mongoose.disconnect();

    console.log("\n✅ Done");
    process.exit(0);
})();