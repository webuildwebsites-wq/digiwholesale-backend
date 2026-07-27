import mongoose from "mongoose";
import dotenv from "dotenv";
import PlatformOwner from "../src/models/Tenant/PlatformOwner.model.js";

dotenv.config();

const seedPlatformOwner = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected to database");

        const existing = await PlatformOwner.findOne({ email: "owner@digiwholesale.in" });
        if (existing) {
            console.log("Platform Owner already exists:", existing.email);
            return;
        }

        const owner = await PlatformOwner.create({
            name:     "DigiWholesale Owner",
            email:    "owner@digibysr.com",
            password: "owner@2026",
            phone:    "9999999999",
            isActive: true,
        });

        console.log("Platform Owner created successfully");
        console.log("Email   :", owner.email);
        console.log("Password: DigiOwner@2026");
        console.log("ID      :", owner._id.toString());

    } catch (err) {
        console.error("Seed failed:", err.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
};

seedPlatformOwner();
