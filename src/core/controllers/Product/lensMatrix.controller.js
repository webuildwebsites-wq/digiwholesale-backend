import mongoose from "mongoose";
import DigiProduct from "../../../models/Product/Product.model.js";
import LensHistory from "../../../models/Product/LensHistory.model.js";

const parsePower = (val) => {
  if (val === null || val === undefined || val === "") return null;
  const cleaned = String(val).replace(/\+/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


export const searchLensProducts = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const tenantId = req.user.tenantId;

    const matchStage = {
      tenantId,
      isDeleted: { $ne: true },
      productName: { $nin: [null, ""] },
      $or: [
        { sph: { $exists: true, $nin: [null, ""] } },
        { category: { $regex: /lens|glass|contact/i } },
      ],
    };

    if (q) {
      matchStage.productName = { $regex: escapeRegex(q), $options: "i" };
    }

    const results = await DigiProduct.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$productName",
          productName: { $first: "$productName" },
          category: { $first: "$category" },
          brand: { $first: "$brand" },
          type: { $first: "$type" },
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
          additions: { $addToSet: "$addition" },
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
      productName: { $regex: `^\\s*${escapeRegex(cleanName)}\\s*$`, $options: "i" },
      isDeleted: { $ne: true },
    })
      .select("productCode productName category brand type sph cyl addition axis qty price buyingPrice sellingPrice mrp createdAt updatedAt")
      .lean();

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No lens products found for "${cleanName}"`,
      });
    }

    const rawSphs = new Set();
    const rawCyls = new Set();
    const rawAdds = new Set();
    const rawAxes = new Set();
    let totalStockQty = 0;

    products.forEach((p) => {
      totalStockQty += (p.qty || 0);

      let s = parsePower(p.sph);
      let c = parsePower(p.cyl);
      let a = parsePower(p.addition);
      const axClean = p.axis ? String(p.axis).replace(/[°\s]/g, "").trim() : "";

      // Handle Plano / zero-power / sunglasses / non-powered products
      if (s === null && c === null && (a === null || a === 0)) {
        s = 0;
        c = 0;
      } else {
        if (s !== null && c === null) c = 0;
        if (s === null && c !== null) s = 0;
      }

      if (s !== null) rawSphs.add(s);
      if (c !== null) rawCyls.add(c);
      if (a !== null && a > 0) rawAdds.add(a);
      if (axClean) rawAxes.add(axClean);
    });

    if (rawSphs.size === 0) rawSphs.add(0);
    if (rawCyls.size === 0) rawCyls.add(0);

    const sortedSphs = Array.from(rawSphs).sort((a, b) => a - b);
    const sortedCyls = Array.from(rawCyls).sort((a, b) => a - b);
    const sortedAdds = Array.from(rawAdds).sort((a, b) => a - b);
    const sortedAxes = Array.from(rawAxes).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));

    const matrixMap = {};
    products.forEach((p) => {
      let s = parsePower(p.sph);
      let c = parsePower(p.cyl);
      let a = parsePower(p.addition);
      const axClean = p.axis ? String(p.axis).replace(/[°\s]/g, "").trim() : "";

      if (s === null && c === null && (a === null || a === 0)) {
        s = 0;
        c = 0;
      } else {
        if (s !== null && c === null) c = 0;
        if (s === null && c !== null) s = 0;
      }

      const itemData = {
        _id: p._id,
        productCode: p.productCode,
        sph: s !== null ? s.toFixed(2) : "0.00",
        cyl: c !== null ? c.toFixed(2) : "0.00",
        addition: a !== null && a > 0 ? a.toFixed(2) : "",
        axis: axClean,
        qty: p.qty ?? 0,
        price: p.price ?? 0,
        buyingPrice: p.buyingPrice ?? p.price ?? 0,
        sellingPrice: p.sellingPrice ?? p.price ?? 0,
        mrp: p.mrp ?? 0,
      };

      if (s !== null && c !== null) {
        const key = `${s.toFixed(2)}_${c.toFixed(2)}`;
        matrixMap[key] = itemData;
      }
      if (s !== null && a !== null && a > 0) {
        const addKey = `${s.toFixed(2)}_ADD_${a.toFixed(2)}`;
        matrixMap[addKey] = itemData;

        if (c !== null) {
          const powerAddKey = `${s.toFixed(2)}_${c.toFixed(2)}_ADD_${a.toFixed(2)}`;
          matrixMap[powerAddKey] = itemData;

          if (axClean) {
            const powerAddAxisKey = `${s.toFixed(2)}_${c.toFixed(2)}_ADD_${a.toFixed(2)}_${axClean}`;
            matrixMap[powerAddAxisKey] = itemData;
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      productName: products[0].productName,
      category: products[0].category,
      brand: products[0].brand,
      type: products.find((p) => p.type)?.type || "",
      totalCount: products.length,
      totalStockQty,
      sphValues: sortedSphs.map((s) => s.toFixed(2)),
      cylValues: sortedCyls.map((c) => c.toFixed(2)),
      additionValues: sortedAdds.map((a) => a.toFixed(2)),
      axisValues: sortedAxes,
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
      productName: { $regex: `^\\s*${escapeRegex(cleanName)}\\s*$`, $options: "i" },
      isDeleted: { $ne: true },
    }).session(session);

    if (!existingProducts || existingProducts.length === 0) {
      throw new Error(`No products found for "${cleanName}"`);
    }

    // Flexible multi-attribute lookup for accurate product matching
    const productByCode = new Map();
    const productById = new Map();
    const productByPowerAndAdd = new Map();
    const productByPowerAddAxis = new Map();
    const productBySphAndAdd = new Map();
    const productsByPower = new Map();
    const productsBySph = new Map();

    const cleanAdd = (a) => {
      if (a === null || a === undefined || a === "") return "";
      const p = parsePower(a);
      if (p === null || p === 0) return "";
      return p.toFixed(2);
    };

    const cleanAxis = (ax) => {
      if (ax === null || ax === undefined || ax === "") return "";
      return String(ax).replace(/[°\s]/g, "").trim();
    };

    const pushToMap = (map, key, val) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(val);
    };

    existingProducts.forEach((p) => {
      if (p.productCode) {
        productByCode.set(p.productCode.trim().toUpperCase(), p);
      }
      productById.set(p._id.toString(), p);

      let s = parsePower(p.sph);
      let c = parsePower(p.cyl);
      const addClean = cleanAdd(p.addition);
      const axClean = cleanAxis(p.axis);

      // Handle Plano / zero power / non-powered products
      if (s === null && c === null && !addClean) {
        s = 0;
        c = 0;
      } else {
        if (s !== null && c === null) c = 0;
        if (s === null && c !== null) s = 0;
      }

      if (s !== null) {
        const sKey = s.toFixed(2);
        pushToMap(productsBySph, sKey, p);

        if (addClean) {
          pushToMap(productBySphAndAdd, `${sKey}_${addClean}`, p);
        }

        if (c !== null) {
          const cKey = c.toFixed(2);
          pushToMap(productsByPower, `${sKey}_${cKey}`, p);

          if (addClean) {
            const powerAddKey = `${sKey}_${cKey}_${addClean}`;
            pushToMap(productByPowerAndAdd, powerAddKey, p);
            pushToMap(productByPowerAddAxis, `${powerAddKey}_${axClean}`, p);
          }
        }
      }
    });

    const findMatchingProducts = (item) => {
      if (item.productCode && productByCode.has(item.productCode.trim().toUpperCase())) {
        return [productByCode.get(item.productCode.trim().toUpperCase())];
      }
      if (item._id && productById.has(String(item._id))) {
        return [productById.get(String(item._id))];
      }
      const rawSph = parsePower(item.sph);
      const hasExplicitCyl = item.cyl !== undefined && item.cyl !== null && String(item.cyl).trim() !== "";
      let s = rawSph;
      let c = parsePower(item.cyl);
      const addClean = cleanAdd(item.addition);
      const axClean = cleanAxis(item.axis);

      // Only fall back to single-variant doc when uploaded row has NO power parameters at all
      if (rawSph === null && !hasExplicitCyl && !addClean) {
        return existingProducts.length === 1 ? [existingProducts[0]] : [];
      }

      if (s === null && c === null && !addClean) {
        s = 0;
        c = 0;
      } else {
        if (s !== null && c === null) c = 0;
        if (s === null && c !== null) s = 0;
      }

      if (s !== null) {
        const sKey = s.toFixed(2);
        if (addClean) {
          if (c !== null && hasExplicitCyl) {
            const cKey = c.toFixed(2);
            const exactAxisKey = `${sKey}_${cKey}_${addClean}_${axClean}`;
            if (productByPowerAddAxis.has(exactAxisKey)) {
              return productByPowerAddAxis.get(exactAxisKey);
            }
            if (!axClean && productByPowerAndAdd.has(`${sKey}_${cKey}_${addClean}`)) {
              return productByPowerAndAdd.get(`${sKey}_${cKey}_${addClean}`);
            }
            return [];
          }
          if (!hasExplicitCyl && !axClean && productBySphAndAdd.has(`${sKey}_${addClean}`)) {
            return productBySphAndAdd.get(`${sKey}_${addClean}`);
          }
          return [];
        }

        if (c !== null && hasExplicitCyl) {
          return productsByPower.get(`${sKey}_${c.toFixed(2)}`) || [];
        }

        if (!hasExplicitCyl && productsBySph.has(sKey)) {
          return productsBySph.get(sKey);
        }
      }

      return [];
    };

    let updatedCount = 0;
    let summaryText = "";

    if (action === "DELETE") {
      const existingHistory = existingProducts
        .flatMap((d) => d.lensUpdateHistory || d.lensHistory || [])
        .filter((h) => h && h.action);

      const idsToDelete = new Set();
      for (const item of updates) {
        if (item.isDelete === false) continue;
        const matches = findMatchingProducts(item);
        matches.forEach((prod) => {
          idsToDelete.add(prod._id.toString());
        });
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
              additionRange: historyEntry.additionRange || "",
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
      const newDocsToInsert = [];
      let createdCount = 0;

      // Base template product to inherit common lens properties (brand, category, coating, etc.)
      const tpl = existingProducts.find((p) => !p.isDeleted) || existingProducts[0];

      // Prepare collision-free productCode generator for new combinations
      let nextCodeNum = 1;
      let codePrefix = "";
      let codeSuffix = "";

      const sampleCode = tpl.productCode || "";
      const prefixNumMatch = sampleCode.match(/^(\d+)(.*)$/);
      const suffixNumMatch = sampleCode.match(/^(.*?)(\d+)$/);

      if (prefixNumMatch) {
        codeSuffix = prefixNumMatch[2];
        existingProducts.forEach((p) => {
          const m = (p.productCode || "").match(/^(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n >= nextCodeNum) nextCodeNum = n + 1;
          }
        });
      } else if (suffixNumMatch) {
        codePrefix = suffixNumMatch[1];
        existingProducts.forEach((p) => {
          const m = (p.productCode || "").match(/(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n >= nextCodeNum) nextCodeNum = n + 1;
          }
        });
      } else {
        codePrefix = (tpl.brand || "DO").substring(0, 4).toUpperCase();
      }

      const existingCodesList = await DigiProduct.find({ tenantId }).distinct("productCode");
      const existingCodesSet = new Set(existingCodesList.map((c) => String(c).toUpperCase()));

      const getNextProductCode = () => {
        while (true) {
          const code = prefixNumMatch
            ? `${nextCodeNum++}${codeSuffix}`
            : `${codePrefix}${nextCodeNum++}`;
          if (!existingCodesSet.has(code.toUpperCase())) {
            existingCodesSet.add(code.toUpperCase());
            return code;
          }
        }
      };

      for (const item of updates) {
        const matchedProds = findMatchingProducts(item);

        if (matchedProds && matchedProds.length > 0) {
          for (const prod of matchedProds) {
            if (action === "UPDATE_QTY") {
              const val = Number(item.value !== undefined ? item.value : item.qty);
              if (isNaN(val)) continue;
              const newQty = Math.max(0, Math.round(val));
              bulkOps.push({
                updateOne: {
                  filter: { _id: prod._id, tenantId },
                  update: { $set: { qty: newQty } },
                },
              });
              updatedCount++;
            } else if (
              action === "UPDATE_PRICE" ||
              action === "UPDATE_SELLING_PRICE" ||
              action === "UPDATE_BUYING_PRICE" ||
              action === "UPDATE_MRP"
            ) {
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

              if (
                Object.keys(updateFields).length === 0 &&
                item.value != null &&
                !isNaN(Number(item.value))
              ) {
                const newPrice = Math.max(0, Number(item.value));
                if (action === "UPDATE_SELLING_PRICE") {
                  updateFields.sellingPrice = newPrice;
                } else if (action === "UPDATE_BUYING_PRICE") {
                  updateFields.buyingPrice = newPrice;
                  updateFields.price = newPrice;
                } else if (action === "UPDATE_MRP") {
                  updateFields.mrp = newPrice;
                } else {
                  updateFields.buyingPrice = newPrice;
                  updateFields.sellingPrice = newPrice;
                  updateFields.mrp = newPrice;
                  updateFields.price = newPrice;
                }
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
        } else {
          // Combination does not exist in DB yet: automatically create/upsert it!
          const sVal = parsePower(item.sph);
          const cVal = parsePower(item.cyl);
          const aVal = cleanAdd(item.addition);

          let newQty = 0;
          if (action === "UPDATE_QTY") {
            const val = Number(item.value !== undefined ? item.value : item.qty);
            if (!isNaN(val)) newQty = Math.max(0, Math.round(val));
          }

          let newBp = tpl.buyingPrice ?? tpl.price ?? 0;
          let newSp = tpl.sellingPrice ?? tpl.price ?? 0;
          let newMrp = tpl.mrp ?? 0;

          if (item.buyingPrice != null && !isNaN(Number(item.buyingPrice))) {
            newBp = Math.max(0, Number(item.buyingPrice));
          }
          if (item.sellingPrice != null && !isNaN(Number(item.sellingPrice))) {
            newSp = Math.max(0, Number(item.sellingPrice));
          }
          if (item.mrp != null && !isNaN(Number(item.mrp))) {
            newMrp = Math.max(0, Number(item.mrp));
          }

          if (item.value != null && !isNaN(Number(item.value))) {
            const valNum = Math.max(0, Number(item.value));
            if (action === "UPDATE_SELLING_PRICE") newSp = valNum;
            else if (action === "UPDATE_BUYING_PRICE") newBp = valNum;
            else if (action === "UPDATE_MRP") newMrp = valNum;
            else if (action === "UPDATE_PRICE") {
              newBp = valNum;
              newSp = valNum;
              newMrp = valNum;
            }
          }

          const newProdDoc = {
            productCode: getNextProductCode(),
            productName: cleanName,
            category: tpl.category,
            brand: tpl.brand || "",
            color: tpl.color || "",
            size: tpl.size || "",
            type: tpl.type || "",
            shape: tpl.shape || "",
            material: tpl.material || "",
            dimensions: tpl.dimensions || "",
            addition: aVal ? aVal : (String(tpl.type || "").toUpperCase() === "SINGLE_VISION" ? "" : (tpl.addition || "")),
            sph: sVal !== null ? sVal.toFixed(2) : (tpl.sph || "0.00"),
            cyl: cVal !== null ? cVal.toFixed(2) : (tpl.cyl || "0.00"),
            axis: item.axis ? cleanAxis(item.axis) : cleanAxis(tpl.axis),
            index: tpl.index || "",
            coating: tpl.coating || "",
            disposability: tpl.disposability || "",
            expiry: tpl.expiry || null,
            price: newBp,
            buyingPrice: newBp,
            sellingPrice: newSp,
            mrp: newMrp,
            gst: tpl.gst ?? 0,
            hsnSac: tpl.hsnSac || "",
            qty: newQty,
            image: tpl.image || "",
            orderSource: tpl.orderSource || "INHOUSE",
            vendor: tpl.vendor || { id: null, name: null },
            createdBy: req.user?._id || req.user?.id || tpl.createdBy,
            tenantId,
          };

          newDocsToInsert.push(newProdDoc);
          createdCount++;
        }
      }

      for (let i = 0; i < bulkOps.length; i += 1000) {
        await DigiProduct.bulkWrite(bulkOps.slice(i, i + 1000), { session });
      }
      for (let i = 0; i < newDocsToInsert.length; i += 1000) {
        await DigiProduct.insertMany(newDocsToInsert.slice(i, i + 1000), { session });
      }

      const totalProcessed = updatedCount + createdCount;
      if (totalProcessed === 0) {
        throw new Error(
          `No valid updates or additions could be processed for "${cleanName}". Please verify the values in the file.`
        );
      }

      if (action === "UPDATE_QTY") {
        summaryText = `Updated stock quantity across ${updatedCount} existing combination(s)`;
      } else if (action === "UPDATE_SELLING_PRICE") {
        summaryText = `Updated selling price across ${updatedCount} existing combination(s)`;
      } else if (action === "UPDATE_BUYING_PRICE") {
        summaryText = `Updated buying price across ${updatedCount} existing combination(s)`;
      } else if (action === "UPDATE_MRP") {
        summaryText = `Updated MRP across ${updatedCount} existing combination(s)`;
      } else {
        summaryText = `Updated prices across ${updatedCount} existing combination(s)`;
      }

      if (createdCount > 0) {
        summaryText += ` and created ${createdCount} new combination(s)`;
      }

      const remainingProducts = await DigiProduct.find({
        tenantId,
        productName: { $regex: `^\\s*${escapeRegex(cleanName)}\\s*$`, $options: "i" },
        isDeleted: { $ne: true },
      })
        .select("sph cyl addition axis qty price buyingPrice sellingPrice mrp lensHistory")
        .session(session)
        .lean();

      if (remainingProducts && remainingProducts.length > 0) {
        const distinctSphs = Array.from(
          new Set(remainingProducts.map((p) => parsePower(p.sph)).filter((x) => x !== null))
        ).sort((a, b) => a - b);
        const distinctCyls = Array.from(
          new Set(remainingProducts.map((p) => parsePower(p.cyl)).filter((x) => x !== null))
        ).sort((a, b) => a - b);
        const distinctAdds = Array.from(
          new Set(remainingProducts.map((p) => parsePower(p.addition)).filter((x) => x !== null))
        ).sort((a, b) => a - b);
        const distinctAxes = Array.from(
          new Set(remainingProducts.map((p) => cleanAxis(p.axis)).filter(Boolean))
        ).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
        const totalStock = remainingProducts.reduce((sum, p) => sum + (p.qty || 0), 0);
        const sample =
          remainingProducts.find((p) => p.sellingPrice || p.buyingPrice || p.mrp) || remainingProducts[0];

        const resolvedPriceType =
          action === "UPDATE_SELLING_PRICE"
            ? "Selling Price"
            : action === "UPDATE_BUYING_PRICE"
            ? "Buying Price"
            : action === "UPDATE_MRP"
            ? "MRP"
            : action === "UPDATE_PRICE"
            ? (priceType || "Buying, Selling & MRP")
            : "";

        const historyEntry = {
          action,
          priceType: resolvedPriceType,
          totalLenses: remainingProducts.length,
          totalStockQty: totalStock,
          sphRange: distinctSphs.length
            ? `${distinctSphs[0].toFixed(2)} to ${distinctSphs[distinctSphs.length - 1].toFixed(2)}`
            : "",
          cylRange: distinctCyls.length
            ? `${distinctCyls[0].toFixed(2)} to ${distinctCyls[distinctCyls.length - 1].toFixed(2)}`
            : "",
          additionRange: distinctAdds.length
            ? `${distinctAdds[0].toFixed(2)} to ${distinctAdds[distinctAdds.length - 1].toFixed(2)}`
            : "",
          axisRange: distinctAxes.length
            ? (distinctAxes.length === 1 ? `${distinctAxes[0]}°` : `${distinctAxes[0]}° to ${distinctAxes[distinctAxes.length - 1]}°`)
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
              priceType: resolvedPriceType,
              totalLenses: remainingProducts.length,
              totalStockQty: totalStock,
              sphRange: historyEntry.sphRange,
              cylRange: historyEntry.cylRange,
              additionRange: historyEntry.additionRange,
              axisRange: historyEntry.axisRange,
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


const formatRange = (min, max) => {
  const pMin = parsePower(min);
  const pMax = parsePower(max);
  if (pMin === null && pMax === null) return "Plano (0.00)";
  if (pMin !== null && pMax !== null) {
    return pMin === pMax ? `${pMin.toFixed(2)}` : `${pMin.toFixed(2)} to ${pMax.toFixed(2)}`;
  }
  return (pMin ?? pMax)?.toFixed(2) || "Plano (0.00)";
};

export const getLensHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { productName } = req.query;

    const historyTimeline = [];
    const seenEventKeys = new Set();
    // Track which productNames are already covered by the dedicated collection
    // so we don't add duplicate virtual GENERATED entries from legacy fallback
    const dedicatedProductNames = new Set();

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
        dedicatedProductNames.add(item.productName); // mark as covered
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
          additionRange: item.additionRange || "",
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
      // ── Skip ALL legacy processing if this product is already in the dedicated collection ──
      if (dedicatedProductNames.has(prod.productName)) continue;

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
            sphRange: log.sphRange || formatRange(prod.minSph, prod.maxSph),
            cylRange: log.cylRange || formatRange(prod.minCyl, prod.maxCyl),
            buyingPrice: log.buyingPrice ?? prod.sampleBuyingPrice ?? prod.samplePrice ?? 0,
            sellingPrice: log.sellingPrice ?? prod.sampleSellingPrice ?? prod.samplePrice ?? 0,
            mrp: log.mrp ?? prod.sampleMrp ?? 0,
            timestamp,
          });
        }
      }

      // If product has no history at all (not in dedicated, no embedded logs),
      // create a single virtual GENERATED entry so it appears in history.
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
            sphRange: formatRange(prod.minSph, prod.maxSph),
            cylRange: formatRange(prod.minCyl, prod.maxCyl),
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
