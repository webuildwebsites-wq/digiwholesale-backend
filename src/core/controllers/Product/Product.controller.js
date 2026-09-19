import DigiProduct from "../../../models/Product/Product.model.js";
import ProductBatch from "../../../models/Product/ProductBatch.model.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import PurchaseInward from "../../../models/Purchase/PurchaseInward.model.js";
import PurchaseQC from "../../../models/Purchase/PurchaseQC.model.js";
import Vendor from "../../../models/Vendor.model.js";
import { uploadToGCSProduct } from "../../../Utils/uploads/uploadToGCS.js";
import { getNextBatchNumber } from "./batch.controller.js";
import mongoose from "mongoose";

//  CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    // Parse products from FormData
    let products = JSON.parse(req.body.products || "[]");

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No products provided",
      });
    }

    // Validate required fields
    for (const p of products) {
      const hasBuyingPrice = p.buyingPrice != null || p.price != null;
      if (
        !p.productCode ||
        !p.productName ||
        !p.category ||
        !hasBuyingPrice ||
        p.mrp == null
      ) {
        return res.status(400).json({
          success: false,
          message: "Required fields missing in one of the products (productCode, productName, category, buyingPrice/price, mrp)",
        });
      }
    }

    // Check duplicate productCode
    const productCodes = products.map((p) => p.productCode.trim());

    const existingProducts = await DigiProduct.find({
      tenantId: req.user.tenantId,
      productCode: { $in: productCodes },
    });

    if (existingProducts.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more product codes already exist",
        existingCodes: existingProducts.map((p) => p.productCode),
      });
    }

    console.log("=== CREATE PRODUCT REQUEST ===");
    console.log(
      "req.files received:",
      req.files?.map((f) => ({
        fieldname: f.fieldname,
        size: f.size,
        originalname: f.originalname,
      })),
    );

    // Attach color images to correct product index and color index
    if (req.files?.length) {
      await Promise.all(
        products.map(async (product, index) => {
          // Specific image for each color in the product
          if (Array.isArray(product.colors)) {
            await Promise.all(
              product.colors.map(async (colorObj, cIndex) => {
                const colorFile = req.files.find(
                  (f) =>
                    f.fieldname === `productColorImage_${index}_${cIndex}` ||
                    f.fieldname === `productColorImage_${cIndex}`,
                );

                if (colorFile) {
                  console.log(
                    `Uploading file for field: ${colorFile.fieldname} (size: ${colorFile.size} bytes)`,
                  );
                  const colorImagePath = await uploadToGCSProduct(colorFile);
                  console.log(
                    `Uploaded to GCS: ${colorFile.fieldname} -> ${colorImagePath}`,
                  );
                  colorObj.productColorImage = colorImagePath;
                } else if (!colorObj.productColorImage) {
                  colorObj.productColorImage = "";
                }
              }),
            );
          }
        }),
      );
    }

    // Lookup vendor names if vendor IDs are provided
    const vendorIds = products
      .map((p) => (typeof p.vendor === "string" && mongoose.Types.ObjectId.isValid(p.vendor) ? p.vendor : p.vendor?.id))
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    let vendorMap = new Map();
    if (vendorIds.length > 0) {
      const vendorsList = await Vendor.find({ _id: { $in: vendorIds } }).lean();
      vendorMap = new Map(vendorsList.map((v) => [v._id.toString(), v.vendorName || v.name || v.companyName]));
    }

    // Prepare documents
    const productDocs = products.map((p) => ({
      productCode: p.productCode.trim(),
      category: p.category.trim().toUpperCase(),
      productName: p.productName.trim().toUpperCase(),
      brand: p.brand?.trim()?.toUpperCase() || "",
      color: (p.color?.trim()) || (Array.isArray(p.colors) && p.colors[0]?.color?.trim()) || "",
      colors: Array.isArray(p.colors) && p.colors.length > 0
        ? p.colors.map((c) => ({
            color: c.color?.trim() || "",
            qty: Number(c.qty) || 0,
            productColorImage: c.productColorImage || "",
          }))
        : (p.color?.trim() ? [{ color: p.color.trim(), qty: Number(p.qty) || 0, productColorImage: "" }] : []),
      size: p.size?.trim() || "",
      type: p.type?.trim() || "",
      shape: p.shape?.trim() || "",
      sph: p.sph?.trim() || "",
      cyl: p.cyl?.trim() || "",
      index: p.index?.trim() || "",
      axis: p.axis?.trim() || "",
      addition: p.addition?.trim() || "",
      material: p.material?.trim() || "",
      dimensions: p.dimensions?.trim() || "",
      coating: p.coating?.trim() || "",
      expiry: p.expiry || "",
      price: Number(p.buyingPrice != null ? p.buyingPrice : (p.price ?? 0)),
      buyingPrice: Number(p.buyingPrice != null ? p.buyingPrice : (p.price ?? 0)),
      sellingPrice: Number(p.sellingPrice != null ? p.sellingPrice : (p.price ?? 0)),
      gst: Number(p.gst) || 0,
      hsnSac: p.hsnSac?.trim() || "",
      mrp: Number(p.mrp ?? 0),
      qty: Number(p.qty),
      vendor: (() => {
        if (p.vendor && mongoose.Types.ObjectId.isValid(p.vendor)) {
          const vName = vendorMap.get(p.vendor.toString()) || p.vendorName || null;
          return { id: p.vendor, name: vName };
        }
        if (typeof p.vendor === "object" && p.vendor !== null) {
          const vId = p.vendor.id || null;
          const vName = p.vendor.name || (vId ? vendorMap.get(vId.toString()) : null) || null;
          return { id: vId, name: vName };
        }
        if (p.vendorName) {
          return { id: null, name: p.vendorName };
        }
        return { id: null, name: null };
      })(),
      tenantId: req.user.tenantId,
    }));

    const savedProducts = await DigiProduct.insertMany(productDocs);

    // Batch allocations for newly created products
    for (let idx = 0; idx < savedProducts.length; idx++) {
      const savedProduct = savedProducts[idx];
      const pInput = products[idx] || {};

      if (pInput.allocateBatch !== false) {
        const bQty = pInput.batchQty !== undefined && pInput.batchQty !== "" && pInput.batchQty !== null
          ? Number(pInput.batchQty)
          : Number(savedProduct.qty || 0);

        if (bQty > 0) {
          let bNum = pInput.batchNumber ? pInput.batchNumber.trim().toUpperCase() : "";
          if (!bNum) {
            bNum = await getNextBatchNumber(savedProduct._id, req.user.tenantId);
          }

          let vId = savedProduct.vendor?.id || null;
          let vName = savedProduct.vendor?.name || null;

          await ProductBatch.create({
            batchNumber: bNum,
            productId: savedProduct._id,
            initialQty: bQty,
            availableQty: bQty,
            costPrice: savedProduct.buyingPrice || savedProduct.price || 0,
            buyingPrice: savedProduct.buyingPrice || savedProduct.price || 0,
            sellingPrice: savedProduct.sellingPrice || savedProduct.price || 0,
            mrp: savedProduct.mrp || 0,
            vendorId: vId,
            vendorName: vName,
            remarks: pInput.batchRemarks?.trim() || "Initial batch allocation on product creation",
            invoices: Array.isArray(pInput.invoices) ? pInput.invoices : [],
            status: "OPEN",
            tenantId: req.user.tenantId,
            createdBy: req.user._id,
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      count: savedProducts.length,
      products: savedProducts,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Suggestions
export const suggestionProduct = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    if (!q || q.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Query must be at least 3 characters.",
      });
    }

    const products = await DigiProduct.find({
      tenantId: req.user.tenantId,
      $or: [
        { productCode: { $regex: q, $options: "i" } },
        { productName: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { type: { $regex: q, $options: "i" } },
      ],
    })
      .select("productCode productName category brand type")
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (err) {
    console.error("product suggestions error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

//  GET ALL PRODUCTS - pagination (STORE WISE)
export const getProducts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      DigiProduct.find({ tenantId: req.user.tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      DigiProduct.countDocuments({ tenantId: req.user.tenantId }),
    ]);

    const hasMore = page * limit < total;

    res.status(200).json({
      success: true,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      hasMore,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// get stores products data by category
export const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const data = await DigiProduct.find({
      tenantId: req.user.tenantId,
      category,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get by category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//  GET SINGLE PRODUCT
export const getProductById = async (req, res) => {
  try {
    const product = await DigiProduct.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

//  UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const p = req.body;

    const product = await DigiProduct.findOne({
      productCode: p.productCode,
      tenantId: req.user.tenantId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    //  Update fields
    product.category = p.category.trim().toUpperCase();
    product.productName = p.productName.trim().toUpperCase();
    product.brand = p.brand.trim().toUpperCase();
    const trimmedColor = p.color?.trim() || "";
    product.color = trimmedColor;
    if (trimmedColor) {
      if (Array.isArray(product.colors) && product.colors.length > 0) {
        product.colors[0].color = trimmedColor;
      } else {
        product.colors = [{ color: trimmedColor, qty: product.qty || 0, productColorImage: product.image || "" }];
      }
    }
    product.size = p.size?.trim() || "";
    product.type = p.type?.trim() || "";
    product.shape = p.shape?.trim() || "";
    product.sph = p.sph?.trim() || "";
    product.cyl = p.cyl?.trim() || "";
    product.index = p.index?.trim() || "";
    product.axis = p.axis?.trim() || "";

    product.addition = p.addition?.trim() || "";
    product.material = p.material?.trim() || "";
    product.dimensions = p.dimensions?.trim() || "";

    product.coating = p.coating?.trim() || "";
    product.expiry = p.expiry || null;
    if (p.buyingPrice != null && p.buyingPrice !== "") product.buyingPrice = Number(p.buyingPrice);
    if (p.sellingPrice != null && p.sellingPrice !== "") product.sellingPrice = Number(p.sellingPrice);
    if (p.price != null && p.price !== "") {
      product.price = Number(p.price);
      if (product.buyingPrice == null) product.buyingPrice = product.price;
    }
    product.gst = p.gst != null ? Number(p.gst) : 0;
    product.hsnSac = p.hsnSac?.trim() || "";
    if (p.mrp != null && p.mrp !== "") product.mrp = Number(p.mrp);
    if (p.qty != null && p.qty !== "") product.qty = Number(p.qty);

    // Update vendor if provided
    if (p.vendorId) {
      product.vendor = {
        id: mongoose.Types.ObjectId.isValid(p.vendorId) ? p.vendorId : null,
        name: p.vendorName || null,
      };
    }

    //  If image uploaded — use GCS (same as createProduct)
    if (req.file) {
      try {
        const imageUrl = await uploadToGCSProduct(req.file);
        product.image = imageUrl;
      } catch (uploadErr) {
        console.error("Image upload to GCS failed:", uploadErr);
        // Don't fail the whole update — just skip image update
      }
    }

    await product.save();

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("updateProduct error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

//  DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const product = await DigiProduct.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await ProductBatch.deleteMany({
      productId: req.params.id,
      tenantId: req.user.tenantId,
    }).catch(err => console.error("Error deleting product batches:", err));

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  DELETE BULK PRODUCTS
export const deleteBulkProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required",
      });
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid product IDs provided",
      });
    }

    const result = await DigiProduct.deleteMany({
      _id: { $in: validIds },
      tenantId: req.user.tenantId,
    });

    await ProductBatch.deleteMany({
      productId: { $in: validIds },
      tenantId: req.user.tenantId,
    }).catch(err => console.error("Error deleting batches for bulk deleted products:", err));

    res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} products deleted successfully`,
    });
  } catch (error) {
    console.error("deleteBulkProducts error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  ADD INVENTORY
export const addInventory = async (req, res) => {
  try {
    let { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Inventory data is required" });
    }

    for (const item of items) {
      if (!item.productCode || !item.qty) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Product code and qty are required",
          });
      }
      if (item.qty <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Quantity must be greater than 0" });
      }
    }

    const productCodes = items.map((i) => i.productCode);

    const products = await DigiProduct.find({
      tenantId: req.user.tenantId,
      productCode: { $in: productCodes },
    });

    if (products.length !== productCodes.length) {
      const foundCodes = products.map((p) => p.productCode);
      const missing = productCodes.filter((c) => !foundCodes.includes(c));
      return res
        .status(404)
        .json({
          success: false,
          message: `Product not found: ${missing.join(", ")}`,
        });
    }

    const productMap = {};
    products.forEach((p) => {
      productMap[p.productCode] = p;
    });

    for (const item of items) {
      const product = productMap[item.productCode];
      const addedQty = Number(item.qty || 0);
      product.qty += addedQty;

      const buyingP = item.buyingPrice != null ? Number(item.buyingPrice) : (item.price != null ? Number(item.price) : null);
      const sellingP = item.sellingPrice != null ? Number(item.sellingPrice) : null;
      const mrpP = item.mrp != null ? Number(item.mrp) : null;

      if (buyingP != null) {
        product.buyingPrice = buyingP;
        product.price = buyingP;
      }
      if (sellingP != null) product.sellingPrice = sellingP;
      if (mrpP != null && mrpP > 0) product.mrp = mrpP;
      if (item.expiry) product.expiry = item.expiry;
      if (item.vendorId) {
        product.vendor = { id: item.vendorId, name: item.vendorName || "" };
      }

      // Determine batch number
      let bNum = item.batchNumber?.trim() ? item.batchNumber.trim().toUpperCase() : "";
      if (!bNum) {
        bNum = await getNextBatchNumber(product._id, req.user.tenantId);
      } else {
        // Prevent duplicate batch numbers for the same product
        const existingBatch = await ProductBatch.findOne({
          productId: product._id,
          tenantId: req.user.tenantId,
          batchNumber: bNum,
        });
        if (existingBatch) {
          return res.status(400).json({
            success: false,
            message: `Batch number "${bNum}" already exists for product ${product.productCode}. Please specify a different batch number or leave blank to auto-generate.`,
          });
        }
      }

      await ProductBatch.create({
        batchNumber: bNum,
        productId: product._id,
        initialQty: addedQty,
        availableQty: addedQty,
        costPrice: buyingP != null ? buyingP : (product.buyingPrice || product.price || 0),
        buyingPrice: buyingP != null ? buyingP : (product.buyingPrice || product.price || 0),
        sellingPrice: sellingP != null ? sellingP : (product.sellingPrice || product.price || 0),
        mrp: mrpP != null ? mrpP : (product.mrp || 0),
        vendorId: item.vendorId || product.vendor?.id || null,
        vendorName: item.vendorName || product.vendor?.name || null,
        inwardDate: item.inwardDate ? new Date(item.inwardDate) : new Date(),
        expiry: item.expiry ? new Date(item.expiry) : null,
        remarks: item.remarks || "Stock added via inventory",
        invoices: Array.isArray(item.invoices) ? item.invoices : [],
        status: "OPEN",
        tenantId: req.user.tenantId,
        createdBy: req.user._id,
      });
    }

    await Promise.all(products.map((p) => p.save()));

    return res.status(200).json({
      success: true,
      message: `Updated quantity and created batches for ${products.length} product(s)`,
      updated: products.map((p) => ({
        _id: p._id,
        productCode: p.productCode,
        productName: p.productName,
        qty: p.qty,
        buyingPrice: p.buyingPrice,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        vendor: p.vendor,
        expiry: p.expiry,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET INVENTORY BY PRODUCT ID (WITH RECEIVING HISTORY, BATCHES & DETAILS)
export const getInventoryByProductId = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Product ID is required",
      });
    }

    const product = await DigiProduct.findOne({
      tenantId: req.user.tenantId,
      _id: productId,
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Auto-resolve vendor name if vendor.id is present but vendor.name is missing
    if (product.vendor?.id && !product.vendor?.name) {
      const vendorDoc = await Vendor.findById(product.vendor.id).lean();
      if (vendorDoc) {
        product.vendor.name = vendorDoc.vendorName || vendorDoc.name || vendorDoc.companyName || null;
      }
    }

    // 1. Fetch batches for this product
    const batches = await ProductBatch.find({
      productId: product._id,
      tenantId: req.user.tenantId,
    }).sort({ createdAt: -1 }).lean();

    // Ensure all batches have vendorName resolved
    for (const b of batches) {
      if (!b.vendorName) {
        if (b.vendorId && product.vendor?.id && b.vendorId.toString() === product.vendor.id.toString()) {
          b.vendorName = product.vendor.name;
        } else if (b.vendorId) {
          const vDoc = await Vendor.findById(b.vendorId).lean();
          if (vDoc) b.vendorName = vDoc.vendorName || vDoc.name || vDoc.companyName || null;
        } else if (product.vendor?.name) {
          b.vendorName = product.vendor.name;
        }
      }
    }

    // 2. Fetch purchase orders containing this product
    const purchaseOrders = await VendorPurchase.find({
      tenantId: req.user.tenantId,
      $or: [
        { "orders.items.productId": product._id },
        { "orders.items.code": product.productCode },
      ],
    }).sort({ createdAt: -1 }).lean();

    // 3. Fetch purchase inwards containing this product or corresponding to these POs
    const poIds = purchaseOrders.map((po) => po._id);
    const purchaseInwards = await PurchaseInward.find({
      tenantId: req.user.tenantId,
      $or: [
        { "items.productId": product._id },
        { purchaseOrderId: { $in: poIds } },
      ],
    }).sort({ inwardDate: -1, createdAt: -1 }).lean();

    // 4. Fetch PurchaseQC records for these POs or inwards
    const inwardIds = purchaseInwards.map((i) => i._id);
    const qcRecords = await PurchaseQC.find({
      tenantId: req.user.tenantId,
      $or: [
        { purchaseOrderId: { $in: poIds } },
        { purchaseInwardId: { $in: inwardIds } },
        { "items.productId": product._id },
      ],
    }).sort({ qcDate: -1, createdAt: -1 }).lean();

    // Build receiving history entries
    const receivingHistory = [];
    const processedInwardItemKeys = new Set();
    const usedBatchIds = new Set();

    for (const inward of purchaseInwards) {
      const poDoc = purchaseOrders.find(
        (po) => po._id.toString() === (inward.purchaseOrderId?.toString() || "")
      );

      for (const item of (inward.items || [])) {
        // Find matching purchase order item
        let poItem = null;
        if (poDoc) {
          for (const ord of poDoc.orders || []) {
            const found = (ord.items || []).find(
              (pi) =>
                (pi._id && item.itemId && pi._id.toString() === item.itemId.toString()) ||
                (pi.productId && pi.productId.toString() === product._id.toString()) ||
                (pi.code && pi.code === product.productCode)
            );
            if (found) {
              poItem = found;
              break;
            }
          }
        }

        const isThisProduct =
          (item.productId && item.productId.toString() === product._id.toString()) ||
          (poItem && (poItem.productId?.toString() === product._id.toString() || poItem.code === product.productCode)) ||
          (item.itemName && item.itemName.toLowerCase() === product.productName.toLowerCase());

        if (isThisProduct) {
          const itemKey = `${inward._id}_${item.itemId || item._id || item.itemName}`;
          if (!processedInwardItemKeys.has(itemKey)) {
            processedInwardItemKeys.add(itemKey);

            // Find matching QC record and item
            let matchedQc = null;
            let matchedQcItem = null;
            for (const qc of qcRecords) {
              const isMatchQc =
                (qc.purchaseInwardId && qc.purchaseInwardId.toString() === inward._id.toString()) ||
                (qc.purchaseOrderId && inward.purchaseOrderId && qc.purchaseOrderId.toString() === inward.purchaseOrderId.toString());

              if (isMatchQc) {
                const qi = (qc.items || []).find(
                  (q) =>
                    (q.itemId && item.itemId && q.itemId.toString() === item.itemId.toString()) ||
                    (q.productId && q.productId.toString() === product._id.toString()) ||
                    (q.itemName && item.itemName && q.itemName.toLowerCase() === item.itemName.toLowerCase())
                );
                if (qi) {
                  matchedQc = qc;
                  matchedQcItem = qi;
                  break;
                }
              }
            }

            // Find matching batch (created for this inward or QC or PO)
            let matchedBatch = null;
            for (const b of batches) {
              if (
                (b.purchaseInwardId && b.purchaseInwardId.toString() === inward._id.toString()) ||
                (matchedQc && b.purchaseQCId && b.purchaseQCId.toString() === matchedQc._id.toString()) ||
                (b.purchaseOrderId && inward.purchaseOrderId && b.purchaseOrderId.toString() === inward.purchaseOrderId.toString()) ||
                (b.batchNumber && item.vendorRefId && b.batchNumber.toUpperCase() === item.vendorRefId.trim().toUpperCase())
              ) {
                matchedBatch = b;
                usedBatchIds.add(b._id.toString());
                break;
              }
            }

            const batchNo = matchedBatch?.batchNumber || (item.vendorRefId && !mongoose.Types.ObjectId.isValid(item.vendorRefId) ? item.vendorRefId : "—");
            const vendorName = matchedBatch?.vendorName || inward.vendorName || poDoc?.vendor?.vendorName || product.vendor?.name || "—";
            const vendorId = matchedBatch?.vendorId || inward.vendorId || poDoc?.vendor?.vendorId || product.vendor?.id || null;

            const passedQty = matchedQcItem?.passedQty != null
              ? matchedQcItem.passedQty
              : (poItem?.passedQty != null ? poItem.passedQty : (matchedBatch != null ? matchedBatch.initialQty : item.receivedQty));

            const failedQty = matchedQcItem?.failedQty != null
              ? matchedQcItem.failedQty
              : (poItem?.failedQty != null ? poItem.failedQty : 0);

            const qcResult = matchedQcItem?.qcResult || poItem?.qcStatus || (matchedBatch ? "PASSED" : "PENDING");
            const failureReason = matchedQcItem?.failureReason || "";
            const qcRemarks = matchedQcItem?.remarks || "";

            const combinedInvoices = [
              ...(Array.isArray(inward.invoices) ? inward.invoices : []),
              ...(matchedBatch && Array.isArray(matchedBatch.invoices) ? matchedBatch.invoices : []),
            ];
            const uniqueInvoices = Array.from(
              new Map(combinedInvoices.filter(Boolean).map((inv) => [inv.url, inv])).values()
            );

            receivingHistory.push({
              _id: inward._id,
              type: "PURCHASE_INWARD",
              inwardId: inward._id,
              purchaseOrderId: inward.purchaseOrderId,
              purchaseQCId: matchedQc?._id || null,
              orderNumber: item.orderNumber || poDoc?.purchaseOrderSummary?.orderNumber || "—",
              dateOfPurchase: poDoc?.createdAt || inward.createdAt,
              inwardDate: inward.inwardDate || inward.createdAt,
              receivedOn: inward.receivedOn || inward.inwardDate || inward.createdAt,
              receivedBy: inward.receivedBy || "—",
              receivedFrom: inward.receivedFrom || inward.vendorName || "—",
              vendorName,
              vendorId,
              batchNumber: batchNo,
              batchId: matchedBatch?._id || null,
              invoiceNumber: item.vendorRefId || inward.remarks || "—",
              orderedQty: item.orderedQty || poItem?.qty || item.receivedQty,
              receivedQty: item.receivedQty || 0,
              passedQty,
              failedQty,
              qcStatus: qcResult,
              failureReason,
              qcRemarks,
              availableQty: matchedBatch != null ? matchedBatch.availableQty : passedQty,
              initialQty: matchedBatch != null ? matchedBatch.initialQty : passedQty,
              buyingPrice: (poItem?.price != null && poItem.price > 0) ? poItem.price : (matchedBatch?.costPrice ?? matchedBatch?.buyingPrice ?? (product.buyingPrice || product.price || 0)),
              sellingPrice: (matchedBatch?.sellingPrice != null && matchedBatch.sellingPrice > 0) ? matchedBatch.sellingPrice : (product.sellingPrice || product.price || 0),
              mrp: (poItem?.mrp != null && poItem.mrp > 0) ? poItem.mrp : (matchedBatch?.mrp != null && matchedBatch.mrp > 0 ? matchedBatch.mrp : (product.mrp || 0)),
              gst: poItem?.gst != null ? poItem.gst : (product.gst || 0),
              condition: item.condition || "GOOD",
              inwardStatus: poItem?.inwardStatus || inward.status || "Confirmed",
              remarks: inward.remarks || item.remarks || qcRemarks || "",
              invoices: uniqueInvoices,
            });
          }
        }
      }
    }

    // Also include any standalone batches (e.g. initial product creation or manual stock additions)
    for (const batch of batches) {
      if (usedBatchIds.has(batch._id.toString())) continue;

      // Also verify it was not linked to any inward or purchase order in receivingHistory
      const isLinkedToInward = receivingHistory.some(
        (rh) =>
          (rh.inwardId && batch.purchaseInwardId && rh.inwardId.toString() === batch.purchaseInwardId.toString()) ||
          (rh.purchaseOrderId && batch.purchaseOrderId && rh.purchaseOrderId.toString() === batch.purchaseOrderId.toString()) ||
          (rh.batchNumber && batch.batchNumber && rh.batchNumber.toUpperCase() === batch.batchNumber.toUpperCase())
      );

      if (!isLinkedToInward) {
        usedBatchIds.add(batch._id.toString());
        receivingHistory.push({
          _id: batch._id,
          type: "BATCH_ALLOCATION",
          inwardId: null,
          purchaseOrderId: batch.purchaseOrderId || null,
          purchaseQCId: batch.purchaseQCId || null,
          orderNumber: "—",
          dateOfPurchase: batch.createdAt,
          inwardDate: batch.inwardDate || batch.createdAt,
          receivedOn: batch.inwardDate || batch.createdAt,
          receivedBy: "—",
          receivedFrom: batch.vendorName || product.vendor?.name || "—",
          vendorName: batch.vendorName || product.vendor?.name || "—",
          vendorId: batch.vendorId || product.vendor?.id || null,
          batchNumber: batch.batchNumber,
          batchId: batch._id,
          invoiceNumber: "—",
          orderedQty: batch.initialQty,
          receivedQty: batch.initialQty,
          passedQty: batch.initialQty,
          failedQty: 0,
          qcStatus: "PASSED",
          availableQty: batch.availableQty,
          initialQty: batch.initialQty,
          buyingPrice: batch.costPrice != null ? batch.costPrice : (batch.buyingPrice != null ? batch.buyingPrice : (product.buyingPrice || product.price || 0)),
          sellingPrice: batch.sellingPrice != null ? batch.sellingPrice : (product.sellingPrice || product.price || 0),
          mrp: batch.mrp != null ? batch.mrp : (product.mrp || 0),
          gst: product.gst || 0,
          condition: "GOOD",
          inwardStatus: "Confirmed",
          batchStatus: batch.status,
          remarks: batch.remarks || "Batch allocation",
          invoices: batch.invoices || [],
        });
      }
    }

    // Sort receiving history by date descending
    receivingHistory.sort(
      (a, b) => new Date(b.receivedOn || b.inwardDate || b.dateOfPurchase) - new Date(a.receivedOn || a.inwardDate || a.dateOfPurchase)
    );

    // If receivingHistory is empty, provide the baseline opening inventory
    if (receivingHistory.length === 0 && (product.qty > 0 || product.createdAt)) {
      receivingHistory.push({
        _id: product._id,
        type: "INITIAL_STOCK",
        inwardId: null,
        purchaseOrderId: null,
        orderNumber: "INITIAL",
        dateOfPurchase: product.createdAt,
        inwardDate: product.createdAt,
        receivedOn: product.createdAt,
        receivedBy: "System",
        receivedFrom: product.vendor?.name || "Default Vendor",
        vendorName: product.vendor?.name || "Default Vendor",
        vendorId: product.vendor?.id || null,
        batchNumber: "INITIAL-STOCK",
        invoiceNumber: "OPENING",
        orderedQty: product.qty || 0,
        receivedQty: product.qty || 0,
        availableQty: product.qty || 0,
        buyingPrice: product.price || 0,
        sellingPrice: product.mrp || 0,
        gst: product.gst || 0,
        condition: "GOOD",
        inwardStatus: "Confirmed",
        qcStatus: "PASSED",
        remarks: "Opening inventory stock",
        invoices: product.invoices || [],
      });
    }

    const enrichedProduct = {
      ...product,
      buyingPrice: product.buyingPrice != null ? product.buyingPrice : (product.price || 0),
      sellingPrice: product.sellingPrice != null ? product.sellingPrice : (product.price || 0),
      mrp: product.mrp || 0,
    };

    res.status(200).json({
      success: true,
      data: {
        product: enrichedProduct,
        batches,
        receivingHistory,
        inventory: [enrichedProduct],
      },
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET INVENTORY BY PROUDCT ID
export const getInventoryByProductCode = async (req, res) => {
  try {
    const { productCode } = req.params;

    if (!productCode) {
      return res.status(400).json({
        success: false,
        message: "Product code is required",
      });
    }

    const inventory = await DigiProduct.find({
      tenantId: req.user.tenantId,
      productCode,
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getDigiProductNames = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const filter = {
      tenantId: req.user.tenantId,
      productName: { $nin: [null, ""] },
    };

    if (search.trim()) {
      filter.productName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const products = await DigiProduct.find(filter)
      .sort({ productName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Get Digi Products Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getFrameSunglassProducts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, brand, isActive } = req.query;

    const filter = {
      tenantId: req.user.tenantId,
      category: { $in: ["FRAME", "SUNGLASS"] },
    };

    if (brand) filter.brand = { $regex: brand.trim(), $options: "i" };
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (search) {
      const regex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { productName: regex },
        { productCode: regex },
        { brand: regex },
      ];
    }

    const [products, total] = await Promise.all([
      DigiProduct.find(filter).sort({ productName: 1 }).skip(skip).limit(limit),
      DigiProduct.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      hasMore: page * limit < total,
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// get vendors data by date range or by keyword
export const filterProducts = async (req, res) => {
  try {
    const { startDate, endDate, keyword } = req.body;
    if (!startDate && !keyword) {
      return res.status(400).json({
        success: false,
        message: "Date range or keyword is required",
      });
    }

    let query = { tenantId: req.user.tenantId };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    if (keyword) {
      const regex = new RegExp(keyword, "i");

      query.$or = [
        { productCode: regex },
        { productName: regex },
        { category: regex },
        { brand: regex },
        { type: regex },
      ];
    }

    const productsData = await DigiProduct.find(query).sort({ createdAt: -1 });

    if (!productsData.length) {
      return res.status(200).json({
        success: false,
        message: "No data exist with this date/keyword filter",
      });
    }

    return res.status(200).json({
      success: true,
      total: productsData.length,
      products: productsData,
    });
  } catch (error) {
    console.error("Filter Products Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const bulkUploadProducts = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { _id: userId } = req.user;

    let products = JSON.parse(req.body.products || "[]");

    if (!products.length) throw new Error("No products provided");

    for (const p of products) {
      if (!p.productName || !p.category || (p.price == null && p.buyingPrice == null) || p.mrp == null) {
        throw new Error(
          "Missing required fields: productName, category, price, mrp",
        );
      }
      if (!p.productCode) {
        throw new Error(
          `productCode is required for product: ${p.productName}`,
        );
      }
    }

    const allCodes = products.map((p) => p.productCode.trim());

    if (new Set(allCodes).size !== allCodes.length) {
      throw new Error("Duplicate productCode found in request");
    }

    const existing = await DigiProduct.find({
      tenantId: req.user.tenantId,
      productCode: { $in: allCodes },
    }).session(session);

    if (existing.length > 0) {
      throw new Error(
        `ProductCodes already exist: ${existing.map((e) => e.productCode).join(", ")}`,
      );
    }

    const docs = products.map((p) => ({
      productCode: p.productCode.trim(),
      productName: p.productName.trim().toUpperCase(),
      category: p.category.trim().toUpperCase(),
      brand: p.brand?.trim()?.toUpperCase() || "",
      color: p.color?.trim()?.toUpperCase() || "",
      size: p.size?.trim()?.toUpperCase() || "",
      type: p.type?.trim()?.toUpperCase() || "",
      shape: p.shape?.trim()?.toUpperCase() || "",
      material: p.material?.trim()?.toUpperCase() || "",
      dimensions: p.dimensions?.trim() || "",
      addition: p.addition?.trim() || "",
      sph: p.sph?.toString().trim() || "",
      cyl: p.cyl?.toString().trim() || "",
      axis: p.axis?.toString().trim() || "",
      index: p.index?.toString().trim() || "",
      coating: p.coating?.trim()?.toUpperCase() || "",
      expiry: p.expiry || null,
      price: Number(p.buyingPrice != null ? p.buyingPrice : (p.price ?? 0)),
      buyingPrice: Number(p.buyingPrice != null ? p.buyingPrice : (p.price ?? 0)),
      sellingPrice: Number(p.sellingPrice != null ? p.sellingPrice : (p.price ?? 0)),
      mrp: Number(p.mrp),
      gst: Number(p.gst) || 0,
      hsnSac: p.hsnSac?.trim() || "",
      qty: Number(p.qty) || 0,
      image: p.image || "",
      orderSource:
        p.orderSource || (p.vendor?.id || p.vendor?.name ? "ORDER" : "INHOUSE"),
      vendor: p.vendor || { id: null, name: null },
      createdBy: userId,
      tenantId: req.user.tenantId,
    }));

    const saved = await DigiProduct.insertMany(docs, { session });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      count: saved.length,
      products: saved,
    });
  } catch (err) {
    await session.abortTransaction();

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } finally {
    session.endSession();
  }
};
