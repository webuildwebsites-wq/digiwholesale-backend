import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import DigiProduct from "../src/models/Product/Product.model.js";
import ProductBatch from "../src/models/Product/ProductBatch.model.js";
const DRY_RUN = false;


async function getMaxBatchNumberFromDB(productId, tenantId) {
    const batches = await ProductBatch.find({ productId, tenantId })
        .select("batchNumber")
        .lean();

    let maxNum = 0;
    for (const b of batches) {
        if (!b.batchNumber) continue;
        const match = b.batchNumber.match(/BTCN(\d+)$/i);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    }
    return maxNum;
}

async function runBatchAllocation() {
    try {
        const mongoUrl = process.env.MONGODB_URL;
        if (!mongoUrl) {
            console.error("❌ Error: MONGODB_URL is missing in .env file.");
            process.exit(1);
        }

        console.log("=================================================");
        if (DRY_RUN) {
            console.log("🔍 MODE: DRY RUN (SIMULATION ONLY - NO DB WRITES)");
        } else {
            console.log("🚀 MODE: LIVE EXECUTION (DB WRITES WILL BE SAVED)");
        }
        console.log("=================================================\n");

        console.log("Connecting to MongoDB...");
        await mongoose.connect(mongoUrl);
        console.log("✅ Connected successfully to MongoDB.\n");

        const products = await DigiProduct.find({}).lean();
        console.log(`📦 Found ${products.length} products in inventory.\n`);

        let processedProducts = 0;
        let batchesCreatedCount = 0;
        let skippedProducts = 0;

        for (const product of products) {
            const productId = product._id;
            const tenantId = product.tenantId || null;
            const totalStock = Number(product.qty || 0);

            if (totalStock <= 0) {
                console.log(`[SKIP] Product ${product.productCode || productId} (${product.productName || 'Unnamed'}) has 0 stock.`);
                skippedProducts++;
                continue;
            }

            const openBatches = await ProductBatch.find({ productId, tenantId, status: "OPEN" }).lean();
            const allocatedQty = openBatches.reduce((sum, b) => sum + Number(b.availableQty || 0), 0);
            const unallocatedQty = Math.max(totalStock - allocatedQty, 0);

            if (unallocatedQty <= 0) {
                console.log(`[SKIP] Product ${product.productCode || productId} (${product.productName}) - All ${totalStock} stock already allocated to open batches.`);
                skippedProducts++;
                continue;
            }

            console.log(`🔹 Product ${product.productCode || productId} (${product.productName}): Total Stock=${totalStock}, Already Allocated=${allocatedQty}, Unallocated=${unallocatedQty}`);

            let batchCounter = await getMaxBatchNumberFromDB(productId, tenantId);

            if (unallocatedQty === 1) {
                batchCounter += 1;
                const batchNum = `BTCN${batchCounter}`;

                const batchPayload = {
                    batchNumber: batchNum,
                    productId: productId,
                    initialQty: 1,
                    availableQty: 1,
                    costPrice: Number(product.price || 0),
                    status: "OPEN",
                    remarks: "Bulk script batch allocation (100% single batch)",
                    tenantId: tenantId,
                };

                if (!DRY_RUN) {
                    await ProductBatch.create(batchPayload);
                }

                console.log(`   └─ ${DRY_RUN ? '[WOULD CREATE]' : '[CREATED]'} Batch: ${batchNum} (Qty: 1, Cost: ₹${batchPayload.costPrice})`);
                batchesCreatedCount += 1;
            } else {
                const batch1Qty = Math.ceil(unallocatedQty / 2);
                const batch2Qty = Math.floor(unallocatedQty / 2);

                // Batch 1
                batchCounter += 1;
                const batch1Num = `BTCN${batchCounter}`;
                const batch1Payload = {
                    batchNumber: batch1Num,
                    productId: productId,
                    initialQty: batch1Qty,
                    availableQty: batch1Qty,
                    costPrice: Number(product.price || 0),
                    status: "OPEN",
                    remarks: "Bulk script batch allocation (Batch 1 of 2)",
                    tenantId: tenantId,
                };

                if (!DRY_RUN) {
                    await ProductBatch.create(batch1Payload);
                }

                // Batch 2
                batchCounter += 1;
                const batch2Num = `BTCN${batchCounter}`;
                const batch2Payload = {
                    batchNumber: batch2Num,
                    productId: productId,
                    initialQty: batch2Qty,
                    availableQty: batch2Qty,
                    costPrice: Number(product.price || 0),
                    status: "OPEN",
                    remarks: "Bulk script batch allocation (Batch 2 of 2)",
                    tenantId: tenantId,
                };

                if (!DRY_RUN) {
                    await ProductBatch.create(batch2Payload);
                }

                console.log(`   ├─ ${DRY_RUN ? '[WOULD CREATE]' : '[CREATED]'} Batch 1: ${batch1Num} (Qty: ${batch1Qty}, Cost: ₹${batch1Payload.costPrice})`);
                console.log(`   └─ ${DRY_RUN ? '[WOULD CREATE]' : '[CREATED]'} Batch 2: ${batch2Num} (Qty: ${batch2Qty}, Cost: ₹${batch2Payload.costPrice})`);
                batchesCreatedCount += 2;
            }

            processedProducts++;
        }

        console.log("\n=================================================");
        console.log(`🎉 Batch Allocation Summary ${DRY_RUN ? '(DRY RUN SIMULATION)' : '(LIVE SAVED)'}:`);
        console.log(` - Products Processed & Allocated: ${processedProducts}`);
        console.log(` - Total Batches ${DRY_RUN ? 'to be Created' : 'Created'}:     ${batchesCreatedCount}`);
        console.log(` - Products Skipped (0 stock/full): ${skippedProducts}`);
        console.log("=================================================\n");

        if (DRY_RUN) {
            console.log("ℹ️  Note: No changes were saved to MongoDB because DRY_RUN = true.");
            console.log("👉 To apply these changes to the database, edit scripts/allocateBatchesForInventory.js, set 'const DRY_RUN = false;', and run the script again.\n");
        }

    } catch (error) {
        console.error("❌ Batch allocation script error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runBatchAllocation();
