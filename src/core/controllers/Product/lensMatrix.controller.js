import mongoose from "mongoose";
import DigiProduct from "../../../models/Product/Product.model.js";

// Helper to normalize optical powers to numeric float (e.g. "+0.25" / "0.25" -> 0.25)
const parsePower = (val) => {
  if (val === null || val === undefined || val === "") return null;
  const cleaned = String(val).replace(/\+/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// 1. Search distinct lens products by name (for autocomplete / suggestions)
export const searchLensProducts = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const tenantId = req.user.tenantId;

    const matchStage = {
      tenantId,
      productName: { $nin: [null, ""] },
      $or: [
        { sph: { $exists: true, $nin: [null, ""] } },
        { category: { $regex: /lens|glass|contact/i } },
      ],
    };

    if (q) {
      matchStage.productName = { $regex: q, $options: "i" };
    }

    const results = await DigiProduct.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$productName",
          productName: { $first: "$productName" },
          category: { $first: "$category" },
          brand: { $first: "$brand" },
          totalVariants: { $sum: 1 },
          totalQty: { $sum: "$qty" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
          minBuyingPrice: { $min: "$buyingPrice" },
          maxBuyingPrice: { $max: "$buyingPrice" },
          minSellingPrice: { $min: "$sellingPrice" },
          maxSellingPrice: { $max: "$sellingPrice" },
          minMrp: { $min: "$mrp" },
          maxMrp: { $max: "$mrp" },
          sphs: { $addToSet: "$sph" },
          cyls: { $addToSet: "$cyl" },
          createdAt: { $min: "$createdAt" },
          updatedAt: { $max: "$updatedAt" },
        },
      },
      { $sort: { totalVariants: -1, productName: 1 } },
      { $limit: 25 },
    ]);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Search Lens Products Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to search lens products",
    });
  }
};

// 2. Get Matrix Grid Data for an existing Lens Product
export const getLensMatrixData = async (req, res) => {
  try {
    const { productName } = req.query;
    if (!productName || !productName.trim()) {
      return res.status(400).json({
        success: false,
        message: "productName query parameter is required",
      });
    }

    const tenantId = req.user.tenantId;
    const cleanName = productName.trim().toUpperCase();

    const products = await DigiProduct.find({
      tenantId,
      productName: { $regex: `^${cleanName}$`, $options: "i" },
    })
      .select("productCode productName category brand sph cyl addition qty price buyingPrice sellingPrice mrp createdAt updatedAt")
      .lean();

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No lens products found for "${cleanName}"`,
      });
    }

    // Extract and sort distinct SPH and CYL values numerically
    const rawSphs = new Set();
    const rawCyls = new Set();

    products.forEach((p) => {
      const s = parsePower(p.sph);
      const c = parsePower(p.cyl);
      if (s !== null) rawSphs.add(s);
      if (c !== null) rawCyls.add(c);
    });

    const sortedSphs = Array.from(rawSphs).sort((a, b) => a - b);
    const sortedCyls = Array.from(rawCyls).sort((a, b) => a - b);

    // Build matrix lookup map: key = `${sph.toFixed(2)}_${cyl.toFixed(2)}`
    const matrixMap = {};
    products.forEach((p) => {
      const s = parsePower(p.sph);
      const c = parsePower(p.cyl);
      if (s !== null && c !== null) {
        const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
        matrixMap[key] = {
          _id: p._id,
          productCode: p.productCode,
          sph: s.toFixed(2),
          cyl: c.toFixed(2),
          addition: p.addition || "",
          qty: p.qty ?? 0,
          price: p.price ?? 0,
          buyingPrice: p.buyingPrice ?? p.price ?? 0,
          sellingPrice: p.sellingPrice ?? p.price ?? 0,
          mrp: p.mrp ?? 0,
        };
      }
    });

    return res.status(200).json({
      success: true,
      productName: products[0].productName,
      category: products[0].category,
      brand: products[0].brand,
      totalCount: products.length,
      sphValues: sortedSphs.map((s) => s.toFixed(2)),
      cylValues: sortedCyls.map((c) => c.toFixed(2)),
      matrix: matrixMap,
      products,
    });
  } catch (error) {
    console.error("Get Lens Matrix Data Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve lens matrix data",
    });
  }
};

// 3. Update Lens Matrix directly on DigiProduct using bulkWrite (Zero extra models)
export const updateLensMatrix = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      productName,
      action = "UPDATE_QTY", // "UPDATE_QTY" | "UPDATE_PRICE" | "DELETE"
      priceType = "sellingPrice", // "buyingPrice" | "sellingPrice" | "mrp" | "price" | "all"
      updates = [], // array of { sph, cyl, value }
    } = req.body;

    if (!productName || !productName.trim()) {
      throw new Error("productName is required");
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("No matrix updates provided");
    }

    const cleanName = productName.trim().toUpperCase();
    const tenantId = req.user.tenantId;

    // Fetch existing products for this product name
    const existingProducts = await DigiProduct.find({
      tenantId,
      productName: { $regex: `^${cleanName}$`, $options: "i" },
    }).session(session);

    if (!existingProducts || existingProducts.length === 0) {
      throw new Error(`No products found for "${cleanName}"`);
    }

    // Build lookup by normalized numeric power: `${sph.toFixed(2)}_${cyl.toFixed(2)}`
    const productLookup = new Map();
    existingProducts.forEach((p) => {
      const s = parsePower(p.sph);
      const c = parsePower(p.cyl);
      if (s !== null && c !== null) {
        const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
        productLookup.set(key, p);
      }
    });

    const bulkOps = [];
    let updatedCount = 0;

    for (const item of updates) {
      const s = parsePower(item.sph);
      const c = parsePower(item.cyl);

      if (s === null || c === null) continue;
      const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
      const prod = productLookup.get(key);

      if (!prod) continue; // No matching product for this combination

      if (action === "UPDATE_QTY") {
        const val = Number(item.value);
        if (isNaN(val)) continue;
        const newQty = Math.max(0, Math.round(val));
        const oldQty = prod.qty || 0;
        if (newQty !== oldQty) {
          bulkOps.push({
            updateOne: {
              filter: { _id: prod._id, tenantId },
              update: { $set: { qty: newQty } },
            },
          });
          updatedCount++;
        }
      } else if (action === "UPDATE_PRICE") {
        const updateFields = {};

        if (item.buyingPrice != null && !isNaN(Number(item.buyingPrice))) {
          const bp = Math.max(0, Number(item.buyingPrice));
          updateFields.buyingPrice = bp;
          updateFields.price = bp;
        }
        if (item.sellingPrice != null && !isNaN(Number(item.sellingPrice))) {
          updateFields.sellingPrice = Math.max(0, Number(item.sellingPrice));
        }
        if (item.mrp != null && !isNaN(Number(item.mrp))) {
          updateFields.mrp = Math.max(0, Number(item.mrp));
        }

        // If no discrete fields provided, fall back to item.value
        if (Object.keys(updateFields).length === 0 && item.value != null && !isNaN(Number(item.value))) {
          const newPrice = Math.max(0, Number(item.value));
          updateFields.buyingPrice = newPrice;
          updateFields.sellingPrice = newPrice;
          updateFields.mrp = newPrice;
          updateFields.price = newPrice;
        }

        if (Object.keys(updateFields).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { _id: prod._id, tenantId },
              update: { $set: updateFields },
            },
          });
          updatedCount++;
        }
      } else if (action === "DELETE") {
        bulkOps.push({
          deleteOne: {
            filter: { _id: prod._id, tenantId },
          },
        });
        updatedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await DigiProduct.bulkWrite(bulkOps, { session });
    }

    let summaryText = "";
    if (action === "UPDATE_QTY") {
      summaryText = `Updated stock quantity across ${updatedCount} lens combination(s)`;
    } else if (action === "UPDATE_PRICE") {
      summaryText = `Updated prices (Buying, Selling & MRP) across ${updatedCount} lens combination(s)`;
    } else if (action === "DELETE") {
      summaryText = `Deleted ${updatedCount} lens combination(s)`;
    }

    // Refresh remaining product metrics to record accurate transaction snapshot
    const remainingProducts = await DigiProduct.find({
      tenantId,
      productName: { $regex: `^${cleanName}$`, $options: "i" },
    })
      .select("sph cyl qty price buyingPrice sellingPrice mrp")
      .session(session)
      .lean();

    if (remainingProducts && remainingProducts.length > 0) {
      const distinctSphs = Array.from(new Set(remainingProducts.map((p) => parsePower(p.sph)).filter((x) => x !== null))).sort((a, b) => a - b);
      const distinctCyls = Array.from(new Set(remainingProducts.map((p) => parsePower(p.cyl)).filter((x) => x !== null))).sort((a, b) => a - b);
      const totalStock = remainingProducts.reduce((sum, p) => sum + (p.qty || 0), 0);
      const sample = remainingProducts.find((p) => p.sellingPrice || p.buyingPrice || p.mrp) || remainingProducts[0];

      const historyEntry = {
        action,
        priceType: action === "UPDATE_PRICE" ? "Buying, Selling & MRP" : "",
        totalLenses: remainingProducts.length,
        totalStockQty: totalStock,
        sphRange: distinctSphs.length ? `${distinctSphs[0].toFixed(2)} to ${distinctSphs[distinctSphs.length - 1].toFixed(2)}` : "",
        cylRange: distinctCyls.length ? `${distinctCyls[0].toFixed(2)} to ${distinctCyls[distinctCyls.length - 1].toFixed(2)}` : "",
        buyingPrice: sample.buyingPrice ?? sample.price ?? 0,
        sellingPrice: sample.sellingPrice ?? sample.price ?? 0,
        mrp: sample.mrp ?? 0,
        updatedAt: new Date(),
      };

      let targetDoc = await DigiProduct.findOneAndUpdate(
        {
          tenantId,
          productName: { $regex: `^${cleanName}$`, $options: "i" },
          lensHistory: { $exists: true, $ne: null },
        },
        { $push: { lensHistory: historyEntry } },
        { session }
      );

      if (!targetDoc) {
        targetDoc = await DigiProduct.findOneAndUpdate(
          { tenantId, productName: { $regex: `^${cleanName}$`, $options: "i" } },
          { $set: { lensHistory: [historyEntry] } },
          { session, sort: { createdAt: 1 }, new: true }
        );
      }

      // Ensure no other variant documents have lensHistory field
      if (targetDoc) {
        await DigiProduct.updateMany(
          {
            tenantId,
            productName: { $regex: `^${cleanName}$`, $options: "i" },
            _id: { $ne: targetDoc._id },
          },
          { $unset: { lensHistory: 1 } },
          { session }
        );
      }
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `${summaryText} for "${cleanName}".`,
      updatedCount,
      totalSubmitted: updates.length,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Update Lens Matrix Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update lens matrix",
    });
  } finally {
    session.endSession();
  }
};

// 4. Get History of Lens Products (Returns every transaction event with ZERO extra models)
export const getLensHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { productName } = req.query;

    const matchStage = {
      tenantId,
      productName: { $nin: [null, ""] },
      $or: [
        { sph: { $exists: true, $nin: [null, ""] } },
        { category: { $regex: /lens|glass|contact/i } },
      ],
    };

    if (productName && productName.trim()) {
      matchStage.productName = { $regex: productName.trim(), $options: "i" };
    }

    // Group by productName to inspect combinations, pricing, and embedded lensHistory
    const grouped = await DigiProduct.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$productName",
          productName: { $first: "$productName" },
          category: { $first: "$category" },
          brand: { $first: "$brand" },
          totalLenses: { $sum: 1 },
          totalStockQty: { $sum: "$qty" },
          sampleBuyingPrice: { $first: "$buyingPrice" },
          sampleSellingPrice: { $first: "$sellingPrice" },
          samplePrice: { $first: "$price" },
          sampleMrp: { $first: "$mrp" },
          minSph: { $min: "$sph" },
          maxSph: { $max: "$sph" },
          minCyl: { $min: "$cyl" },
          maxCyl: { $max: "$cyl" },
          firstGeneratedAt: { $min: "$createdAt" },
          lastUpdatedAt: { $max: "$updatedAt" },
          allHistories: { $push: "$lensHistory" },
        },
      },
      { $sort: { lastUpdatedAt: -1, firstGeneratedAt: -1 } },
    ]);

    const historyTimeline = [];

    for (const prod of grouped) {
      const rawLogs = (prod.allHistories || []).flat().filter((x) => x && x.action);
      // Deduplicate by action + timestamp
      const seen = new Set();
      const logs = [];
      for (const item of rawLogs) {
        const timeKey = `${item.action}_${new Date(item.updatedAt).getTime()}`;
        if (!seen.has(timeKey)) {
          seen.add(timeKey);
          logs.push(item);
        }
      }
      logs.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

      if (logs.length > 0) {
        // Output every recorded transaction as its own row
        for (let i = 0; i < logs.length; i++) {
          const log = logs[i];
          historyTimeline.push({
            _id: `${prod.productName}_log_${i}_${new Date(log.updatedAt).getTime()}`,
            productName: prod.productName,
            category: prod.category,
            brand: prod.brand,
            action: log.action || "UPDATE",
            priceType: log.priceType || "",
            totalLenses: log.totalLenses || prod.totalLenses,
            totalStockQty: log.totalStockQty != null ? log.totalStockQty : prod.totalStockQty,
            sphRange: log.sphRange || `${prod.minSph} to ${prod.maxSph}`,
            cylRange: log.cylRange || `${prod.minCyl} to ${prod.maxCyl}`,
            buyingPrice: log.buyingPrice ?? prod.sampleBuyingPrice ?? prod.samplePrice ?? 0,
            sellingPrice: log.sellingPrice ?? prod.sampleSellingPrice ?? prod.samplePrice ?? 0,
            mrp: log.mrp ?? prod.sampleMrp ?? 0,
            timestamp: log.updatedAt || prod.lastUpdatedAt,
          });
        }
      } else {
        // Fallback for older existing products created prior to lensHistory array:
        // 1. Initial Generation row
        historyTimeline.push({
          _id: `${prod.productName}_gen`,
          productName: prod.productName,
          category: prod.category,
          brand: prod.brand,
          action: "GENERATED",
          priceType: "",
          totalLenses: prod.totalLenses,
          totalStockQty: prod.totalStockQty,
          sphRange: `${prod.minSph} to ${prod.maxSph}`,
          cylRange: `${prod.minCyl} to ${prod.maxCyl}`,
          buyingPrice: prod.sampleBuyingPrice ?? prod.samplePrice ?? 0,
          sellingPrice: prod.sampleSellingPrice ?? prod.samplePrice ?? 0,
          mrp: prod.sampleMrp ?? 0,
          timestamp: prod.firstGeneratedAt,
        });

        // 2. If it was updated after initial generation, also show an update transaction row
        if (
          prod.lastUpdatedAt &&
          prod.firstGeneratedAt &&
          new Date(prod.lastUpdatedAt).getTime() - new Date(prod.firstGeneratedAt).getTime() > 10000
        ) {
          historyTimeline.push({
            _id: `${prod.productName}_upd`,
            productName: prod.productName,
            category: prod.category,
            brand: prod.brand,
            action: "UPDATE",
            priceType: "",
            totalLenses: prod.totalLenses,
            totalStockQty: prod.totalStockQty,
            sphRange: `${prod.minSph} to ${prod.maxSph}`,
            cylRange: `${prod.minCyl} to ${prod.maxCyl}`,
            buyingPrice: prod.sampleBuyingPrice ?? prod.samplePrice ?? 0,
            sellingPrice: prod.sampleSellingPrice ?? prod.samplePrice ?? 0,
            mrp: prod.sampleMrp ?? 0,
            timestamp: prod.lastUpdatedAt,
          });
        }
      }
    }

    // Sort complete transaction timeline descending by timestamp
    historyTimeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({
      success: true,
      count: historyTimeline.length,
      data: historyTimeline,
    });
  } catch (error) {
    console.error("Get Lens History Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch lens history",
    });
  }
};
