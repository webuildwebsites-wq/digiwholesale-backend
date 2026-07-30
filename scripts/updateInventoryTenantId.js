import mongoose from "mongoose";
import dotenv from "dotenv";
import DigiProduct from "../src/models/Product/Product.model.js";

dotenv.config();

const TENANT_ID = "TEN-ANISHO-77SKV";

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Connected to database");

    const allProducts = await DigiProduct.find({});
    console.log(`Total Products: ${allProducts.length}`);

    const result = await DigiProduct.updateMany(
      {}, // Update all products
      {
        $set: {
          tenantId: TENANT_ID,
        },
      }
    );

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
  } catch (err) {
    console.error("Script failed:", err);
  } finally {
    await mongoose.connection.close();
    console.log("✅ Connection closed.");
  }
};

run();