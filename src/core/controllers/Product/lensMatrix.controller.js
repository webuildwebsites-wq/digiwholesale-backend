import mongoose from "mongoose";
import DigiProduct from "../../../models/Product/Product.model.js";
import LensHistory from "../../../models/Product/LensHistory.model.js";

const parsePower = (val) => {
  if (val === null || val === undefined || val === "") return null;
  const cleaned = String(val).replace(/\+/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};


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

export const updateLensMatrix = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      productName,
      action = "UPDATE_QTY", 
      priceType = "sellingPrice", 
      updates = [], 
    } = req.body;

    if (!productName || !productName.trim()) {
      throw new Error("productName is required");
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("No matrix updates provided");
    }

    const cleanName = productName.trim().toUpperCase();
    const tenantId = req.user.tenantId;

    const existingProducts = await DigiProduct.find({
      tenantId,
      productName: { $regex: `^${cleanName}$`, $options: "i" },
    }).session(session);

    if (!existingProducts || existingProducts.length === 0) {
      throw new Error(`No products found for "${cleanName}"`);
    }

    const productLookup = new Map();
    existingProducts.forEach((p) => {
      const s = parsePower(p.sph);
      const c = parsePower(p.cyl);
      if (s !== null && c !== null) {
        const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
        productLookup.set(key, p);
      }
    });

    let updatedCount = 0;
    let summaryText = "";

    if (action === "DELETE") {
      const existingHistory = existingProducts
        .flatMap((d) => d.lensUpdateHistory || d.lensHistory || [])
        .filter((h) => h && h.action);

      const idsToDelete = new Set();
      for (const item of updates) {
        const s = parsePower(item.sph);
        const c = parsePower(item.cyl);
        if (s === null || c === null) continue;
        const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
        const prod = productLookup.get(key);
        if (prod) {
          idsToDelete.add(prod._id.toString());
        }
      }

      if (idsToDelete.size === 0) {
        throw new Error("No matching lens combinations found to delete.");
      }

      const survivingProducts = existingProducts.filter(
        (d) => !idsToDelete.has(d._id.toString()) && !d.isDeleted
      );

      const sample = survivingProducts[0] || existingProducts[0];
      const distinctSphs = Array.from(
        new Set(survivingProducts.map((p) => parsePower(p.sph)).filter((x) => x !== null))
      ).sort((a, b) => a - b);
      const distinctCyls = Array.from(
        new Set(survivingProducts.map((p) => parsePower(p.cyl)).filter((x) => x !== null))
      ).sort((a, b) => a - b);
      const totalStock = survivingProducts.reduce((sum, p) => sum + (p.qty || 0), 0);

      const historyEntry = {
        action: "DELETE",
        priceType: "",
        totalLenses: survivingProducts.length,
        totalStockQty: totalStock,
        sphRange: distinctSphs.length
          ? `${distinctSphs[0].toFixed(2)} to ${distinctSphs[distinctSphs.length - 1].toFixed(2)}`
          : "None (All combinations deleted)",
        cylRange: distinctCyls.length
          ? `${distinctCyls[0].toFixed(2)} to ${distinctCyls[distinctCyls.length - 1].toFixed(2)}`
          : "None (All combinations deleted)",
        buyingPrice: sample?.buyingPrice ?? sample?.price ?? 0,
        sellingPrice: sample?.sellingPrice ?? sample?.price ?? 0,
        mrp: sample?.mrp ?? 0,
        updatedAt: new Date(),
      };

      const combinedHistory = [...existingHistory, historyEntry];
      updatedCount = idsToDelete.size;

      await LensHistory.create(
        [
          {
            tenantId,
            productName: cleanName,
            brand: sample?.brand || existingProducts[0]?.brand || "",
            category: sample?.category || existingProducts[0]?.category || "LENS",
            historyType: "UPDATE",
            action: "DELETE",
            priceType: "",
            totalLenses: survivingProducts.length,
            totalStockQty: totalStock,
            sphRange: historyEntry.sphRange,
            cylRange: historyEntry.cylRange,
            buyingPrice: historyEntry.buyingPrice,
            sellingPrice: historyEntry.sellingPrice,
            mrp: historyEntry.mrp,
            createdBy: req.user?._id || req.user?.id || null,
          },
        ],
        { session }
      );

      if (survivingProducts.length > 0) {
        const keeper = survivingProducts[0];
        await DigiProduct.updateOne(
          { _id: keeper._id },
          {
            $set: {
              lensUpdateHistory: combinedHistory,
              lensHistory: combinedHistory,
            },
          },
          { session }
        );

        await DigiProduct.deleteMany(
          { _id: { $in: Array.from(idsToDelete) }, tenantId },
          { session }
        );

        if (survivingProducts.length > 1) {
          const otherIds = survivingProducts.slice(1).map((p) => p._id);
          await DigiProduct.updateMany(
            { _id: { $in: otherIds } },
            { $unset: { lensHistory: 1, lensUpdateHistory: 1 } },
            { session }
          );
        }
      } else {
        const tombstone = existingProducts[0];
        await DigiProduct.updateOne(
          { _id: tombstone._id },
          {
            $set: {
              isDeleted: true,
              qty: 0,
              lensUpdateHistory: combinedHistory,
              lensHistory: combinedHistory,
            },
          },
          { session }
        );

        const otherIds = Array.from(idsToDelete).filter((id) => id !== tombstone._id.toString());
        if (otherIds.length > 0) {
          await DigiProduct.deleteMany(
            { _id: { $in: otherIds }, tenantId },
            { session }
          );
        }
      }

      summaryText = `Deleted ${updatedCount} lens combination(s)`;
    } else {
      const bulkOps = [];
      for (const item of updates) {
        const s = parsePower(item.sph);
        const c = parsePower(item.cyl);

        if (s === null || c === null) continue;
        const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
        const prod = productLookup.get(key);

        if (!prod) continue; 

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
        }
      }

      if (bulkOps.length > 0) {
        await DigiProduct.bulkWrite(bulkOps, { session });
      }

      if (action === "UPDATE_QTY") {
        summaryText = `Updated stock quantity across ${updatedCount} lens combination(s)`;
      } else if (action === "UPDATE_PRICE") {
        summaryText = `Updated prices (Buying, Selling & MRP) across ${updatedCount} lens combination(s)`;
      }

      const remainingProducts = await DigiProduct.find({
        tenantId,
        productName: { $regex: `^${cleanName}$`, $options: "i" },
        isDeleted: { $ne: true },
      })
        .select("sph cyl qty price buyingPrice sellingPrice mrp lensHistory")
        .session(session)
        .lean();

      if (remainingProducts && remainingProducts.length > 0) {
        const distinctSphs = Array.from(
          new Set(remainingProducts.map((p) => parsePower(p.sph)).filter((x) => x !== null))
        ).sort((a, b) => a - b);
        const distinctCyls = Array.from(
          new Set(remainingProducts.map((p) => parsePower(p.cyl)).filter((x) => x !== null))
        ).sort((a, b) => a - b);
        const totalStock = remainingProducts.reduce((sum, p) => sum + (p.qty || 0), 0);
        const sample =
          remainingProducts.find((p) => p.sellingPrice || p.buyingPrice || p.mrp) || remainingProducts[0];

        const historyEntry = {
          action,
          priceType: action === "UPDATE_PRICE" ? "Buying, Selling & MRP" : "",
          totalLenses: remainingProducts.length,
          totalStockQty: totalStock,
          sphRange: distinctSphs.length
            ? `${distinctSphs[0].toFixed(2)} to ${distinctSphs[distinctSphs.length - 1].toFixed(2)}`
            : "",
          cylRange: distinctCyls.length
            ? `${distinctCyls[0].toFixed(2)} to ${distinctCyls[distinctCyls.length - 1].toFixed(2)}`
            : "",
          buyingPrice: sample.buyingPrice ?? sample.price ?? 0,
          sellingPrice: sample.sellingPrice ?? sample.price ?? 0,
          mrp: sample.mrp ?? 0,
          updatedAt: new Date(),
        };

        const existingHistory = remainingProducts
          .flatMap((d) => d.lensUpdateHistory || d.lensHistory || [])
          .filter((h) => h && h.action);
        const combinedHistory = [...existingHistory, historyEntry];

        await LensHistory.create(
          [
            {
              tenantId,
              productName: cleanName,
              brand: sample?.brand || existingProducts[0]?.brand || "",
              category: sample?.category || existingProducts[0]?.category || "LENS",
              historyType: "UPDATE",
              action,
              priceType: action === "UPDATE_PRICE" ? "Buying, Selling & MRP" : "",
              totalLenses: remainingProducts.length,
              totalStockQty: totalStock,
              sphRange: historyEntry.sphRange,
              cylRange: historyEntry.cylRange,
              buyingPrice: historyEntry.buyingPrice,
              sellingPrice: historyEntry.sellingPrice,
              mrp: historyEntry.mrp,
              createdBy: req.user?._id || req.user?.id || null,
            },
          ],
          { session }
        );

        const keeper = remainingProducts[0];
        await DigiProduct.updateOne(
          { _id: keeper._id },
          {
            $set: {
              lensUpdateHistory: combinedHistory,
              lensHistory: combinedHistory,
            },
          },
          { session }
        );

        if (remainingProducts.length > 1) {
          const otherIds = remainingProducts.slice(1).map((p) => p._id);
          await DigiProduct.updateMany(
            { _id: { $in: otherIds } },
            { $unset: { lensHistory: 1, lensUpdateHistory: 1 } },
            { session }
          );
        }
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


export const getLensHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { productName } = req.query;

    const historyTimeline = [];
    const seenEventKeys = new Set();

    // ── 1. Fetch from Dedicated LensHistory Collection (Primary & Fastest) ──
    const dedicatedFilter = { tenantId };
    if (productName && productName.trim()) {
      dedicatedFilter.productName = { $regex: productName.trim(), $options: "i" };
    }

    const dedicatedRecords = await LensHistory.find(dedicatedFilter)
      .sort({ createdAt: -1 })
      .lean();

    for (const item of dedicatedRecords) {
      const ts = item.createdAt || new Date();
      const timeKey = `${item.productName}_${item.action}_${new Date(ts).getTime()}`;
      if (!seenEventKeys.has(timeKey)) {
        seenEventKeys.add(timeKey);
        historyTimeline.push({
          _id: item._id.toString(),
          productName: item.productName,
          category: item.category || "LENS",
          brand: item.brand || "",
          historyType: item.historyType || (item.action === "GENERATED" ? "GENERATION" : "UPDATE"),
          action: item.action || "UPDATE",
          priceType: item.priceType || "",
          totalLenses: item.totalLenses || 0,
          totalStockQty: item.totalStockQty != null ? item.totalStockQty : 0,
          sphRange: item.sphRange || "",
          cylRange: item.cylRange || "",
          buyingPrice: item.buyingPrice ?? 0,
          sellingPrice: item.sellingPrice ?? 0,
          mrp: item.mrp ?? 0,
          timestamp: ts,
        });
      }
    }

    // ── 2. Fallback / Merge with Legacy DigiProduct Documents (Zero Data Loss) ──
    const matchStage = {
      tenantId,
      productName: { $nin: [null, ""] },
      $or: [
        { sph: { $exists: true, $nin: [null, ""] } },
        { category: { $regex: /lens|glass|contact/i } },
        { lensHistory: { $exists: true, $ne: [] } },
        { lensGenerationHistory: { $exists: true, $ne: [] } },
        { lensUpdateHistory: { $exists: true, $ne: [] } },
      ],
    };

    if (productName && productName.trim()) {
      matchStage.productName = { $regex: productName.trim(), $options: "i" };
    }

    const legacyGrouped = await DigiProduct.aggregate([
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
          generationHistories: { $push: "$lensGenerationHistory" },
          updateHistories: { $push: "$lensUpdateHistory" },
        },
      },
      { $sort: { lastUpdatedAt: -1, firstGeneratedAt: -1 } },
    ]);

    for (const prod of legacyGrouped) {
      const rawLogs = [
        ...(prod.generationHistories || []).flat(),
        ...(prod.updateHistories || []).flat(),
        ...(prod.allHistories || []).flat(),
      ].filter((x) => x && x.action);

      for (let i = 0; i < rawLogs.length; i++) {
        const log = rawLogs[i];
        const timestamp = log.updatedAt || log.generatedAt || prod.lastUpdatedAt;
        const timeKey = `${prod.productName}_${log.action}_${new Date(timestamp).getTime()}`;

        if (!seenEventKeys.has(timeKey)) {
          seenEventKeys.add(timeKey);
          historyTimeline.push({
            _id: `${prod.productName}_legacy_${i}_${new Date(timestamp).getTime()}`,
            productName: prod.productName,
            category: prod.category,
            brand: prod.brand,
            historyType: log.action === "GENERATED" ? "GENERATION" : "UPDATE",
            action: log.action || "UPDATE",
            priceType: log.priceType || "",
            totalLenses: log.totalLenses || prod.totalLenses,
            totalStockQty: log.totalStockQty != null ? log.totalStockQty : prod.totalStockQty,
            sphRange: log.sphRange || `${prod.minSph} to ${prod.maxSph}`,
            cylRange: log.cylRange || `${prod.minCyl} to ${prod.maxCyl}`,
            buyingPrice: log.buyingPrice ?? prod.sampleBuyingPrice ?? prod.samplePrice ?? 0,
            sellingPrice: log.sellingPrice ?? prod.sampleSellingPrice ?? prod.samplePrice ?? 0,
            mrp: log.mrp ?? prod.sampleMrp ?? 0,
            timestamp,
          });
        }
      }

      // If product has no history logs in either collection, create virtual GENERATED entry if not seen
      const hasProductHistory = historyTimeline.some((h) => h.productName === prod.productName);
      if (!hasProductHistory) {
        const genKey = `${prod.productName}_GENERATED_${new Date(prod.firstGeneratedAt).getTime()}`;
        if (!seenEventKeys.has(genKey)) {
          seenEventKeys.add(genKey);
          historyTimeline.push({
            _id: `${prod.productName}_gen`,
            productName: prod.productName,
            category: prod.category,
            brand: prod.brand,
            historyType: "GENERATION",
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
        }
      }
    }

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
