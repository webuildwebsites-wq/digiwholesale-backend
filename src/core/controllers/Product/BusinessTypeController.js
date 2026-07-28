import BusinessType from "../../../models/Product/BusinessType.js";
import { sendErrorResponse, sendSuccessResponse } from "../../../Utils/response/responseHandler.js";

export const createBusinessType = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Business type name is required");
    }

    const existingBusinessType = await BusinessType.findOne({ name: name.trim(), tenantId: req.user.tenantId });
    if (existingBusinessType) {
      return sendErrorResponse(res, 409, "DUPLICATE_ERROR", "Business type already exists");
    }

    const businessType = await BusinessType.create({
      name: name.trim(),
      description,
      createdBy: req.user.id,
      tenantId: req.user.tenantId,
    });

    return sendSuccessResponse(res, 201, businessType, "Business type created successfully");
  } catch (error) {
    console.error("Create Business Type Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to create business type");
  }
};

export const getAllBusinessTypes = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const businessTypes = await BusinessType.find(filter).sort({ name: 1 });

    return sendSuccessResponse(res, 200, businessTypes, "Business types retrieved successfully");
  } catch (error) {
    console.error("Get All Business Types Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve business types");
  }
};

export const getBusinessTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const businessType = await BusinessType.findOne({ _id: id, tenantId: req.user.tenantId });

    if (!businessType) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Business type not found");
    }

    return sendSuccessResponse(res, 200, businessType, "Business type retrieved successfully");
  } catch (error) {
    console.error("Get Business Type Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve business type");
  }
};

export const updateBusinessType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const businessType = await BusinessType.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!businessType) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Business type not found");
    }

    if (name && name.trim() !== businessType.name) {
      const existingBusinessType = await BusinessType.findOne({ name: name.trim(), tenantId: req.user.tenantId });
      if (existingBusinessType) {
        return sendErrorResponse(res, 409, "DUPLICATE_ERROR", "Business type name already exists");
      }
      businessType.name = name.trim();
    }

    if (description !== undefined) businessType.description = description;
    if (isActive !== undefined) businessType.isActive = isActive;

    await businessType.save();

    return sendSuccessResponse(res, 200, businessType, "Business type updated successfully");
  } catch (error) {
    console.error("Update Business Type Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to update business type");
  }
};

export const deleteBusinessType = async (req, res) => {
  try {
    const { id } = req.params;

    const businessType = await BusinessType.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });
    if (!businessType) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Business type not found");
    }

    return sendSuccessResponse(res, 200, null, "Business type deleted successfully");
  } catch (error) {
    console.error("Delete Business Type Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to delete business type");
  }
};
