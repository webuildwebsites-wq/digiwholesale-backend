import Brand from "../../../models/Product/Brand.js";
import Category from "../../../models/Product/Category.js";
import { sendErrorResponse, sendSuccessResponse } from "../../../Utils/response/responseHandler.js";

export const createBrand = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Brand name is required");
    }

    const existingBrand = await Brand.findOne({ name: name.toUpperCase(), tenantId: req.user.tenantId });
    if (existingBrand) {
      return sendErrorResponse(res, 409, "DUPLICATE_ERROR", "Brand already exists");
    }

    const brand = await Brand.create({
      name: name.toUpperCase(),
      description,
      createdBy: req.user.id,
      tenantId: req.user.tenantId,
    });

    return sendSuccessResponse(res, 201, brand, "Brand created successfully");
  } catch (error) {
    console.error("Create Brand Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to create brand");
  }
};

export const getAllBrands = async (req, res) => {
  try {
    const { isActive, includeCategories } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    let query = Brand.find(filter).sort({ name: 1 });

    if (includeCategories === 'true') {
      query = query.populate({
        path: 'categories',
        match: { isActive: true, tenantId: req.user.tenantId },
        select: 'name description isActive'
      });
    }

    const brands = await query;

    return sendSuccessResponse(res, 200, brands, "Brands retrieved successfully");
  } catch (error) {
    console.error("Get All Brands Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve brands");
  }
};

export const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findOne({ _id: id, tenantId: req.user.tenantId }).populate({
      path: 'categories',
      match: { tenantId: req.user.tenantId },
      select: 'name description isActive'
    });

    if (!brand) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Brand not found");
    }

    return sendSuccessResponse(res, 200, brand, "Brand retrieved successfully");
  } catch (error) {
    console.error("Get Brand Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve brand");
  }
};

export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const brand = await Brand.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!brand) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Brand not found");
    }

    if (name && name.toUpperCase() !== brand.name) {
      const existingBrand = await Brand.findOne({ name: name.toUpperCase(), tenantId: req.user.tenantId });
      if (existingBrand) {
        return sendErrorResponse(res, 409, "DUPLICATE_ERROR", "Brand name already exists");
      }
      brand.name = name.toUpperCase();
    }

    if (description !== undefined) brand.description = description;
    if (isActive !== undefined) brand.isActive = isActive;

    await brand.save();

    return sendSuccessResponse(res, 200, brand, "Brand updated successfully");
  } catch (error) {
    console.error("Update Brand Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to update brand");
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!brand) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Brand not found");
    }

    const categoryCount = await Category.countDocuments({ brand: id, tenantId: req.user.tenantId });
    if (categoryCount > 0) {
      return sendErrorResponse(
        res,
        400,
        "VALIDATION_ERROR",
        `Cannot delete brand. It has ${categoryCount} associated categories. Please delete or reassign categories first.`
      );
    }

    await Brand.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });

    return sendSuccessResponse(res, 200, null, "Brand deleted successfully");
  } catch (error) {
    console.error("Delete Brand Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to delete brand");
  }
};
