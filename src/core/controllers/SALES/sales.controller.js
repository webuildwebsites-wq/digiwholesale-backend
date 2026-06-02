import mongoose from "mongoose";
import Sale from "../../../models/SALES/Sale.model"

export const createSale = async (req, res) => {
  try {
    const { storeId, storeNumber } = req.user;
    const { item, amount, qty, discount, subtotal, gst, gstAmt, gstType, totalAmount, paymentMode, } = req.body;
    const sale = await Sale.create({ storeId, storeNumber, item, amount, qty, discount, subtotal, gst, gstAmt, gstType, totalAmount, paymentMode, createdBy: req.user._id, createdByName: req.user.name, });

    res.status(201).json({
      success: true,
      sale,
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateSale = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const fields = [
      "items",
      "amount",
      "qty",
      "discount",
      "subtotal",
      "gst",
      "gstAmt",
      "gstType",
      "totalAmount",
      "paymentMode",
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        sale[field] = req.body[field];
      }
    });

    await sale.save();

    res.status(200).json({
      success: true,
      sale,
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllSales = async (req, res) => {
  try {
    const { storeId } = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { storeId };

    const sales = await Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalSales = await Sale.countDocuments(filter);

    res.status(200).json({
      success: true,
      page,
      limit,
      total: totalSales,
      count: sales.length,
      hasMore: skip + sales.length < totalSales,
      sales,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    })

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    res.status(200).json({
      success: true,
      sale,
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findOneAndDelete({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const filterSales = async (req, res) => {
  try {
    const { storeId } = req.user;
    const { startDate, endDate, keyword } = req.body;

    if (!startDate && !keyword) {
      return res.status(400).json({
        success: false,
        message: "Date range or keyword is required",
      });
    }

    let query = {
      storeId: new mongoose.Types.ObjectId(storeId),
    };

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
        { item: regex },
      ];
    }

    const salesData = await Sale.find(query).sort({ createdAt: -1 });

    if (!salesData.length) {
      return res.status(200).json({
        success: false,
        message: "No data exist with this date/keyword filter",
      });
    }

    return res.status(200).json({
      success: true,
      total: salesData.length,
      sales: salesData,
    });

  } catch (error) {
    console.error("Filter Sales Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};