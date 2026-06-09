import {
  getOrderService, listOrdersService,
  cancelOrderService,
  getProductNamesService, getTintOptionsService, updateDraftOrderService,
  getFrameTypesService, deleteOrderService,
  getProductBrandsService, getProductCategoriesService, getProductTreatmentsService,
  getProductIndexesService, getProductTypesService,
  getProductCoatingsService,
} from "../../services/order/order.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

function handleError(res, err) {
  console.error("[Order]", err?.message || err);
  if (err?.statusCode) {
    return sendErrorResponse(res, err.statusCode, err.code, err.message);
  }
  return sendErrorResponse(res, 500, "INTERNAL_ERROR", err?.message || "Unexpected error");
}

export const getOrder = async (req, res) => {
  try {
    const order = await getOrderService(req.params.id);
    return sendSuccessResponse(res, 200, order);
  } catch (err) {
    return handleError(res, err);
  }
};

export const listOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const result = await listOrdersService({ ...req.query, page, limit });

    const { orders, pagination } = result;
    const paginationMeta = {
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      totalOrders: pagination.total,
      hasNext: pagination.page < pagination.totalPages,
      hasPrev: pagination.page > 1,
    };

    return sendSuccessResponse(res, 200, { orders, pagination: paginationMeta }, "Orders retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await cancelOrderService(req.params.id, req.body.reason);
    return sendSuccessResponse(res, 200, order, "Order cancelled");
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteOrder = async (req, res) => {
  try {
    await deleteOrderService(req.params.id);
    return sendSuccessResponse(res, 200, null, "Order deleted successfully");
  } catch (err) {
    return handleError(res, err);
  }
};


export const getProductNames = async (req, res) => {
  try {
    const { data, pagination } = await getProductNamesService(req.query);
    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data : {
        data : data
      },
      pagination,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getTintOptions = async (req, res) => {
  try {
    const data = await getTintOptionsService();
    return sendSuccessResponse(res, 200, data, "Tint options retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateDraftOrder = async (req, res) => {
  try {
    const order = await updateDraftOrderService(req.params.id, req.body);
    return sendSuccessResponse(res, 200, order, "Draft order updated successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getFrameTypes = async (req, res) => {
  try {
    const data = await getFrameTypesService();
    return sendSuccessResponse(res, 200, data, "Frame types retrieved successfully");
  } catch (err) { return handleError(res, err); }
};

export const getProductBrands = async (req, res) => {
  try {
    const data = await getProductBrandsService();
    return sendSuccessResponse(res, 200, data, "Product brands retrieved successfully");
  } catch (err) { return handleError(res, err); }
};

export const getProductCategories = async (req, res) => {
  try {
    const data = await getProductCategoriesService(req.query);
    return sendSuccessResponse(res, 200, data, "Product categories retrieved successfully");
  } catch (err) { return handleError(res, err); }
};

export const getProductTreatments = async (req, res) => {
  try {
    const data = await getProductTreatmentsService();
    return sendSuccessResponse(res, 200, data, "Product treatments retrieved successfully");
  } catch (err) { return handleError(res, err); }
};

export const getProductIndexes = async (req, res) => {
  try {
    const data = await getProductIndexesService();
    return sendSuccessResponse(res, 200, data, "Product indexes retrieved successfully");
  } catch (err) { return handleError(res, err); }
};

export const getProductTypes = async (req, res) => {
  try {
    const data = await getProductTypesService();
    return sendSuccessResponse(res, 200, data, "Product types retrieved successfully");
  } catch (err) { return handleError(res, err); }
};

export const getProductCoatings = async (req, res) => {
  try {
    const data = await getProductCoatingsService(req.query);
    return sendSuccessResponse(res, 200, data, "Product coatings retrieved successfully");
  } catch (err) { return handleError(res, err); }
};
