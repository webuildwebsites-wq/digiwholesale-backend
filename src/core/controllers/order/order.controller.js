import {
  getOrderService, listOrdersService,
  cancelOrderService,
  updateDraftOrderService,
  deleteOrderService,
  suggestionsOrdersService,
  getRxOrdersService,
  getDraftOrdersService,
  getTintOptionsService,
  getFrameTypesService,
  getProductBrandsService,
  getProductCategoriesService,
  getProductTreatmentsService,
  getProductIndexesService,
  getProductTypesService,
  getProductCoatingsService,
  getProductNamesService,
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
    const order = await getOrderService(req.params.id, req.user.tenantId);
    return sendSuccessResponse(res, 200, order);
  } catch (err) {
    return handleError(res, err);
  }
};

export const listOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const result = await listOrdersService({ ...req.query, page, limit, tenantId: req.user.tenantId });

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
    const order = await cancelOrderService(req.params.id, req.body.reason, req.user.tenantId);
    return sendSuccessResponse(res, 200, order, "Order cancelled");
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteOrder = async (req, res) => {
  try {
    await deleteOrderService(req.params.id, req.user.tenantId);
    return sendSuccessResponse(res, 200, null, "Order deleted successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateDraftOrder = async (req, res) => {
  try {
    const order = await updateDraftOrderService(req.params.id, req.body, req.user.tenantId);
    return sendSuccessResponse(res, 200, order, "Draft order updated successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const suggestionsOrders = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const search = req.query.search || "";

    const orders = await suggestionsOrdersService({ search, limit, tenantId: req.user.tenantId });

    return sendSuccessResponse(res, 200, { orders }, "Order suggestions retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getRxOrders = async (req, res) => {
  try {
    const { page, limit, search, fromDate, toDate, vendorId, customerId } = req.query;

    const result = await getRxOrdersService({
      page:       parseInt(page)  || 1,
      limit:      parseInt(limit) || 20,
      search,
      fromDate,
      toDate,
      vendorId,
      customerId,
      tenantId:   req.user.tenantId,
    });

    return sendSuccessResponse(res, 200, result, "RX orders retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getDraftOrders = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const result = await getDraftOrdersService({
      page,
      limit,
      search:     req.query.search,
      customerId: req.query.customerId,
      fromDate:   req.query.fromDate,
      toDate:     req.query.toDate,
      tenantId:   req.user.tenantId,
    });

    return sendSuccessResponse(res, 200, {
      orders: result.orders,
      pagination: {
        currentPage: result.pagination.page,
        totalPages:  result.pagination.totalPages,
        totalOrders: result.pagination.total,
        hasNext: result.pagination.page < result.pagination.totalPages,
        hasPrev: result.pagination.page > 1,
      },
    }, "Draft orders retrieved successfully");
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

export const getFrameTypes = async (req, res) => {
  try {
    const data = await getFrameTypesService();
    return sendSuccessResponse(res, 200, data, "Frame types retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductBrands = async (req, res) => {
  try {
    const data = await getProductBrandsService({ tenantId: req.user.tenantId });
    return sendSuccessResponse(res, 200, data, "Product brands retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductCategories = async (req, res) => {
  try {
    const data = await getProductCategoriesService({ brand: req.query.brand, tenantId: req.user.tenantId });
    return sendSuccessResponse(res, 200, data, "Product categories retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductTreatments = async (req, res) => {
  try {
    const data = await getProductTreatmentsService({ tenantId: req.user.tenantId });
    return sendSuccessResponse(res, 200, data, "Product treatments retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductIndexes = async (req, res) => {
  try {
    const data = await getProductIndexesService({ tenantId: req.user.tenantId });
    return sendSuccessResponse(res, 200, data, "Product indexes retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductTypes = async (req, res) => {
  try {
    const data = await getProductTypesService();
    return sendSuccessResponse(res, 200, data, "Product types retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductCoatings = async (req, res) => {
  try {
    const data = await getProductCoatingsService({ brand: req.query.brand, category: req.query.category, tenantId: req.user.tenantId });
    return sendSuccessResponse(res, 200, data, "Product coatings retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};

export const getProductNames = async (req, res) => {
  try {
    const data = await getProductNamesService({
      brand: req.query.brand,
      category: req.query.category,
      search: req.query.search,
      limit: req.query.limit,
      page: req.query.page,
      tenantId: req.user.tenantId,
    });
    return sendSuccessResponse(res, 200, data, "Product names retrieved successfully");
  } catch (err) {
    return handleError(res, err);
  }
};
