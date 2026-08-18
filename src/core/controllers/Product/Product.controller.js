import DigiProduct from "../../../models/Product/Product.model.js";
import { uploadToGCSProduct } from "../../../Utils/uploads/uploadToGCS.js";
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
      if (!p.productCode || !p.productName || !p.category || p.price == null || p.mrp == null) {
        return res.status(400).json({
          success: false,
          message: "Required fields missing in one of the products",
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


    // Attach images to correct product index
    if (req.files?.length) {

      await Promise.all(
        products.map(async (product, index) => {

          const file = req.files.find(
            (f) => f.fieldname === `productImage_${index}`
          );

          if (file) {
            const imagePath = await uploadToGCSProduct(file);

            product.image = imagePath; // store filePath (not signed URL)
          }

        })
      );

    }


    // Prepare documents
    const productDocs = products.map((p) => ({
      productCode: p.productCode.trim(),
      category: p.category.trim().toUpperCase(),
      productName: p.productName.trim().toUpperCase(),
      brand: p.brand?.trim()?.toUpperCase() || "",
      colors: Array.isArray(p.colors) ? p.colors : [],
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
      price: Number(p.price),
      gst: Number(p.gst) || 0,
      hsnSac: p.hsnSac?.trim() || "",
      mrp: Number(p.mrp),
      qty: Number(p.qty),
      image: p.image || "",
      tenantId: req.user.tenantId,
    }));

    const savedProducts = await DigiProduct.insertMany(productDocs);

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
    product.color = p.color.trim();
    product.size = p.size.trim();
    product.type = p.type.trim();
    product.shape = p.shape.trim();
    product.sph = p.sph.trim();
    product.cyl = p.cyl.trim();
    product.index = p.index.trim();
    product.axis = p.axis.trim();

    product.addition = p.addition?.trim() || "";
    product.material = p.material?.trim() || "";
    product.dimensions = p.dimensions?.trim() || "";

    product.coating = p.coating.trim();
    product.expiry = p.expiry;
    product.price = p.price;
    product.gst = p.gst;
    product.hsnSac = p.hsnSac.trim();
    product.mrp = p.mrp;
    product.qty = p.qty;

    //  If image uploaded
    if (req.file) {
      const imageUrl =
        `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

      product.image = imageUrl;
    }

    await product.save();

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


//  ADD INVENTORY
export const addInventory = async (req, res) => {
  try {
    let { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Inventory data is required" });
    }

    for (const item of items) {
      if (!item.productCode || !item.qty) {
        return res.status(400).json({ success: false, message: "Product code and qty are required" });
      }
      if (item.qty <= 0) {
        return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
      }
    }

    const productCodes = items.map(i => i.productCode);

    const products = await DigiProduct.find({
      tenantId: req.user.tenantId,
      productCode: { $in: productCodes },
    });

    if (products.length !== productCodes.length) {
      const foundCodes = products.map(p => p.productCode);
      const missing = productCodes.filter(c => !foundCodes.includes(c));
      return res.status(404).json({ success: false, message: `Product not found: ${missing.join(", ")}` });
    }

    const productMap = {};
    products.forEach(p => { productMap[p.productCode] = p; });

    for (const item of items) {
      const product = productMap[item.productCode];
      product.qty += item.qty;
      if (item.mrp && item.mrp > product.mrp) product.mrp = item.mrp;
      if (item.price) product.price = item.price;
    }

    await Promise.all(products.map(p => p.save()));

    return res.status(200).json({
      success: true,
      message: `Updated quantity for ${products.length} product(s)`,
      updated: products.map(p => ({ productCode: p.productCode, qty: p.qty })),
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// GET INVENTORY BY PROUDCT ID
export const getInventoryByProductId = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const inventory = await DigiProduct.find({
      tenantId: req.user.tenantId,
     _id : productId,
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
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
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const skip  = (page - 1) * limit;
    const { search, brand, isActive } = req.query;

    const filter = {
      tenantId: req.user.tenantId,
      category: { $in: ["FRAME", "SUNGLASS"] },
    };

    if (brand)  filter.brand = { $regex: brand.trim(), $options: "i" };
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (search) {
      const regex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { productName: regex },
        { productCode: regex },
        { brand:       regex },
      ];
    }

    const [products, total] = await Promise.all([
      DigiProduct.find(filter).sort({ productName: 1 }).skip(skip).limit(limit),
      DigiProduct.countDocuments(filter),
    ]);

    return res.status(200).json({
      success:      true,
      page,
      limit,
      totalPages:   Math.ceil(total / limit),
      totalProducts: total,
      hasMore:      page * limit < total,
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
      if (!p.productName || !p.category || p.price == null || p.mrp == null) {
        throw new Error("Missing required fields: productName, category, price, mrp");
      }
      if (!p.productCode) {
        throw new Error(`productCode is required for product: ${p.productName}`);
      }
    }

    const allCodes = products.map(p => p.productCode.trim());

    if (new Set(allCodes).size !== allCodes.length) {
      throw new Error("Duplicate productCode found in request");
    }

    const existing = await DigiProduct.find({
      tenantId: req.user.tenantId,
      productCode: { $in: allCodes },
    }).session(session);

    if (existing.length > 0) {
      throw new Error(`ProductCodes already exist: ${existing.map(e => e.productCode).join(", ")}`);
    }

    const docs = products.map(p => ({
      productCode:  p.productCode.trim(),
      productName:  p.productName.trim().toUpperCase(),
      category:     p.category.trim().toUpperCase(),
      brand:        p.brand?.trim()?.toUpperCase()    || "",
      color:        p.color?.trim()?.toUpperCase()    || "",
      size:         p.size?.trim()?.toUpperCase()     || "",
      type:         p.type?.trim()?.toUpperCase()     || "",
      shape:        p.shape?.trim()?.toUpperCase()    || "",
      material:     p.material?.trim()?.toUpperCase() || "",
      dimensions:   p.dimensions?.trim()              || "",
      addition:     p.addition?.trim()                || "",
      sph:          p.sph?.toString().trim()          || "",
      cyl:          p.cyl?.toString().trim()          || "",
      axis:         p.axis?.toString().trim()         || "",
      index:        p.index?.toString().trim()        || "",
      coating:      p.coating?.trim()?.toUpperCase()  || "",
      expiry:       p.expiry                          || null,
      price:        Number(p.price),
      mrp:          Number(p.mrp),
      gst:          Number(p.gst)    || 0,
      hsnSac:       p.hsnSac?.trim() || "",
      qty:          Number(p.qty)    || 0,
      image:        p.image          || "",
      createdBy:    userId,
      tenantId:     req.user.tenantId,
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
