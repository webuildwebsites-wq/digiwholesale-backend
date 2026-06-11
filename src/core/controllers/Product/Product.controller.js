import DigiProduct from "../../../models/Product/Product.model.js";
import Inventory from "../../../models/Product/Inventory.model.js";
import { uploadToGCSProduct } from "../../../Utils/uploads/uploadToGCS.js";


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
    //   storeId,
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
    //   storeId,
    //   storeNumber,
      productCode: p.productCode.trim(),
      category: p.category.trim().toUpperCase(),
      productName: p.productName.trim().toUpperCase(),
      brand: p.brand?.trim()?.toUpperCase() || "",
      color: p.color?.trim() || "",
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
      // createdBy: userId,
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
      // storeId,
      // storeNumber,
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
      DigiProduct.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      DigiProduct.countDocuments({ }),
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
      return res.status(400).json({
        success: false,
        message: "Inventory data is required",
      });
    }


    for (const item of items) {
      const { productCode, qty } = item;

      if (!productCode || !qty) {
        return res.status(400).json({
          success: false,
          message: "Product code and qty are required",
        });
      }

      if (qty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be greater than 0",
        });
      }
    }

    //  FETCH ALL PRODUCTS AT ONCE
    const productCodes = items.map(i => i.productCode);

    const products = await DigiProduct.find({
      productCode: { $in: productCodes },
    });

    if (products.length !== productCodes.length) {
      const foundCodes = products.map(p => p.productCode);
      const missing = productCodes.filter(c => !foundCodes.includes(c));

      return res.status(404).json({
        success: false,
        message: `Product not found: ${missing.join(", ")}`,
      });
    }

    // Map for fast access
    const productMap = {};
    products.forEach(p => {
      productMap[p.productCode] = p;
    });

    //  PREPARE UPDATES
    const inventoryDocs = [];

    for (const item of items) {
      const {
        productCode,
        qty,
        expiry,
        price,
        gst,
        total,
        mrp,
        vendorId,
        vendorName,
      } = item;

      const product = productMap[productCode];

      // Prepare product updates
      product.qty += qty;

      if (mrp && mrp > product.mrp) {
        product.mrp = mrp;
      }

      inventoryDocs.push({
        productId: product._id,
        productCode,
        qty: qty,
        expiry: expiry || null,
        price: price || 0,
        gst: gst || 0,
        total: total || 0,
        mrp: mrp || product.mrp,
        vendorId: vendorId ? vendorId : null,
        vendorName: vendorName || "",
      });
    }

    // Save products
    await Promise.all(products.map(p => p.save()));

    // Save inventory
    const savedInventory = await Inventory.insertMany(inventoryDocs);

    res.status(201).json({
      success: true,
      count: savedInventory.length,
      inventory: savedInventory,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

    let query = {};

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