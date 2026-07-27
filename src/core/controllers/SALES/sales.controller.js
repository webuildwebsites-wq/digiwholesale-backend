import mongoose from "mongoose";
import Sale from "../../../models/SALES/Sale.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";


export const createSale = async (req, res) => {
  try {
    const { item, amount, qty, discount, subtotal, gst, gstAmt, gstType, totalAmount, paymentMode } = req.body;

    const sale = await Sale.create({
      item,
      amount,
      qty,
      discount,
      subtotal,
      gst,
      gstAmt,
      gstType: (gstType ?? "").toUpperCase(),
      totalAmount,
      paymentMode,
      createdBy: req.user._id,
      createdByName: req.user.name,
      tenantId: req.user.tenantId,
    });

    return sendSuccessResponse(res, 201, { sale }, "Sale created successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "CREATE_SALE_ERROR", error.message);
  }
};

export const getAllSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { tenantId: req.user.tenantId };

    const sales = await Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalSales = await Sale.countDocuments(filter);

    return sendSuccessResponse(res, 200, {
      page,
      limit,
      total: totalSales,
      count: sales.length,
      hasMore: skip + sales.length < totalSales,
      sales,
    });

  } catch (error) {
    return sendErrorResponse(res, 500, "GET_SALES_ERROR", error.message);
  }
};

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!sale) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Sale not found");
    }

    return sendSuccessResponse(res, 200, { sale });

  } catch (error) {
    return sendErrorResponse(res, 400, "GET_SALE_ERROR", error.message);
  }
};

export const updateSale = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!sale) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Sale not found");
    }

    const fields = ["item", "amount", "qty", "discount", "subtotal", "gst", "gstAmt", "gstType", "totalAmount", "paymentMode"];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        sale[field] = req.body[field];
      }
    });

    await sale.save();

    return sendSuccessResponse(res, 200, { sale }, "Sale updated successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_SALE_ERROR", error.message);
  }
};

export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!sale) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Sale not found");
    }

    return sendSuccessResponse(res, 200, null, "Sale deleted successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "DELETE_SALE_ERROR", error.message);
  }
};

export const filterSales = async (req, res) => {
  try {
    const { startDate, endDate, keyword } = req.body;

    if (!startDate && !keyword) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Date range or keyword is required");
    }

    let query = {
      tenantId: req.user.tenantId,
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
      query.$or = [{ item: regex }];
    }

    const salesData = await Sale.find(query).sort({ createdAt: -1 });

    if (!salesData.length) {
      return sendErrorResponse(res, 200, "NO_DATA", "No data exist with this date/keyword filter");
    }

    return sendSuccessResponse(res, 200, {
      total: salesData.length,
      sales: salesData,
    });

  } catch (error) {
    console.error("Filter Sales Error:", error);
    return sendErrorResponse(res, 500, "FILTER_SALES_ERROR", error.message);
  }
};
