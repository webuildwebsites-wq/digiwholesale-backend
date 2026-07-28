import Brand from "../../../models/Product/Brand.js";
import Category from "../../../models/Product/Category.js";
import BusinessType from "../../../models/Product/BusinessType.js";
import GSTType from "../../../models/Product/GSTType.js";
import Plant from "../../../models/Product/Plant.js";
import Lab from "../../../models/Product/Lab.js";
import FittingCenter from "../../../models/Product/FittingCenter.js";
import CreditDay from "../../../models/Product/CreditDay.js";
import CourierName from "../../../models/Product/CourierName.js";
import CourierTime from "../../../models/Product/CourierTime.js";
import State from "../../../models/Product/State.js";
import Country from "../../../models/Product/Country.js";
import BillingCurrency from "../../../models/Product/BillingCurrency.js";
import SpecificLab from "../../../models/Product/SpecificLab.js";
import { sendErrorResponse, sendSuccessResponse } from "../../../Utils/response/responseHandler.js";
import mongoose from "mongoose";

const createGenericItem = (Model, itemName) => async (req, res) => {
  try {
    const { name, description, days, location, time } = req.body;

    if (Model.modelName === 'CreditDay' && days === undefined) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${itemName} days is required`);
    }

    if (Model.modelName === 'CourierTime' && (!location || !time)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Location and time are required");
    }

    if (Model.modelName !== 'CreditDay' && Model.modelName !== 'CourierTime' && !name) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${itemName} name is required`);
    }

    const query = Model.modelName === 'CreditDay'
      ? { days, tenantId: req.user.tenantId }
      : Model.modelName === 'CourierTime'
      ? { location: location.trim(), time: time.trim(), tenantId: req.user.tenantId }
      : { name: name.trim(), tenantId: req.user.tenantId };

    const existingItem = await Model.findOne(query);
    if (existingItem) {
      return sendErrorResponse(res, 409, "DUPLICATE_ERROR", `${itemName} already exists`);
    }

    const itemData = Model.modelName === 'CreditDay'
      ? { days, description, createdBy: req.user.id, tenantId: req.user.tenantId }
      : Model.modelName === 'CourierTime'
      ? { location: location.trim(), time: time.trim(), description, createdBy: req.user.id, tenantId: req.user.tenantId }
      : { name: name.trim(), description, createdBy: req.user.id, tenantId: req.user.tenantId };

    const item = await Model.create(itemData);

    return sendSuccessResponse(res, 201, item, `${itemName} created successfully`);
  } catch (error) {
    console.error(`Create ${itemName} Error:`, error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", `Failed to create ${itemName}`);
  }
};

const getAllGenericItems = (Model, itemName) => async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const sortField = Model.modelName === 'CreditDay' ? { days: 1 } : { name: 1 };
    const items = await Model.find(filter).sort(sortField);

    return sendSuccessResponse(res, 200, items, `${itemName}s retrieved successfully`);
  } catch (error) {
    console.error(`Get All ${itemName}s Error:`, error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", `Failed to retrieve ${itemName}s`);
  }
};

const getGenericItemById = (Model, itemName) => async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Model.findOne({ _id: id, tenantId: req.user.tenantId });

    if (!item) {
      return sendErrorResponse(res, 404, "NOT_FOUND", `${itemName} not found`);
    }

    return sendSuccessResponse(res, 200, item, `${itemName} retrieved successfully`);
  } catch (error) {
    console.error(`Get ${itemName} Error:`, error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", `Failed to retrieve ${itemName}`);
  }
};

const updateGenericItem = (Model, itemName) => async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, days, location, time } = req.body;

    const item = await Model.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!item) {
      return sendErrorResponse(res, 404, "NOT_FOUND", `${itemName} not found`);
    }

    if (Model.modelName === 'CreditDay' && days !== undefined && days !== item.days) {
      const existingItem = await Model.findOne({ days, tenantId: req.user.tenantId });
      if (existingItem) {
        return sendErrorResponse(res, 409, "DUPLICATE_ERROR", `${itemName} days already exists`);
      }
      item.days = days;
    }

    if (Model.modelName === 'CourierTime') {
      if (location && location.trim() !== item.location || time && time.trim() !== item.time) {
        const existingItem = await Model.findOne({
          location: location ? location.trim() : item.location,
          time: time ? time.trim() : item.time,
          tenantId: req.user.tenantId,
          _id: { $ne: id }
        });
        if (existingItem) {
          return sendErrorResponse(res, 409, "DUPLICATE_ERROR", `${itemName} already exists`);
        }
        if (location) item.location = location.trim();
        if (time) item.time = time.trim();
      }
    }

    if (Model.modelName !== 'CreditDay' && Model.modelName !== 'CourierTime' && name && name.trim() !== item.name) {
      const existingItem = await Model.findOne({ name: name.trim(), tenantId: req.user.tenantId });
      if (existingItem) {
        return sendErrorResponse(res, 409, "DUPLICATE_ERROR", `${itemName} name already exists`);
      }
      item.name = name.trim();
    }

    if (description !== undefined) item.description = description;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();

    return sendSuccessResponse(res, 200, item, `${itemName} updated successfully`);
  } catch (error) {
    console.error(`Update ${itemName} Error:`, error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", `Failed to update ${itemName}`);
  }
};

const deleteGenericItem = (Model, itemName) => async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Model.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });
    if (!item) {
      return sendErrorResponse(res, 404, "NOT_FOUND", `${itemName} not found`);
    }

    return sendSuccessResponse(res, 200, null, `${itemName} deleted successfully`);
  } catch (error) {
    console.error(`Delete ${itemName} Error:`, error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", `Failed to delete ${itemName}`);
  }
};

// GST Type
export const createGSTType = createGenericItem(GSTType, "GST type");
export const getAllGSTTypes = getAllGenericItems(GSTType, "GST type");
export const getGSTTypeById = getGenericItemById(GSTType, "GST type");
export const updateGSTType = updateGenericItem(GSTType, "GST type");
export const deleteGSTType = deleteGenericItem(GSTType, "GST type");

// Plant
export const createPlant = createGenericItem(Plant, "Plant");
export const getAllPlants = getAllGenericItems(Plant, "Plant");
export const getPlantById = getGenericItemById(Plant, "Plant");
export const updatePlant = updateGenericItem(Plant, "Plant");
export const deletePlant = deleteGenericItem(Plant, "Plant");

// Lab
export const createLab = createGenericItem(Lab, "Lab");
export const getAllLabs = getAllGenericItems(Lab, "Lab");
export const getLabById = getGenericItemById(Lab, "Lab");
export const updateLab = updateGenericItem(Lab, "Lab");
export const deleteLab = deleteGenericItem(Lab, "Lab");

// Fitting Center
export const createFittingCenter = createGenericItem(FittingCenter, "Fitting center");
export const getAllFittingCenters = getAllGenericItems(FittingCenter, "Fitting center");
export const getFittingCenterById = getGenericItemById(FittingCenter, "Fitting center");
export const updateFittingCenter = updateGenericItem(FittingCenter, "Fitting center");
export const deleteFittingCenter = deleteGenericItem(FittingCenter, "Fitting center");

// Credit Day
export const createCreditDay = createGenericItem(CreditDay, "Credit day");
export const getAllCreditDays = getAllGenericItems(CreditDay, "Credit day");
export const getCreditDayById = getGenericItemById(CreditDay, "Credit day");
export const updateCreditDay = updateGenericItem(CreditDay, "Credit day");
export const deleteCreditDay = deleteGenericItem(CreditDay, "Credit day");

// Courier Name
export const createCourierName = createGenericItem(CourierName, "Courier name");
export const getAllCourierNames = getAllGenericItems(CourierName, "Courier name");
export const getCourierNameById = getGenericItemById(CourierName, "Courier name");
export const updateCourierName = updateGenericItem(CourierName, "Courier name");
export const deleteCourierName = deleteGenericItem(CourierName, "Courier name");

// Courier Time
export const createCourierTime = createGenericItem(CourierTime, "Courier time");
export const getAllCourierTimes = getAllGenericItems(CourierTime, "Courier time");
export const getCourierTimeById = getGenericItemById(CourierTime, "Courier time");
export const updateCourierTime = updateGenericItem(CourierTime, "Courier time");
export const deleteCourierTime = deleteGenericItem(CourierTime, "Courier time");

// State
export const createState = createGenericItem(State, "State");
export const getAllStates = getAllGenericItems(State, "State");
export const getStateById = getGenericItemById(State, "State");
export const updateState = updateGenericItem(State, "State");
export const deleteState = deleteGenericItem(State, "State");

// Country
export const createCountry = createGenericItem(Country, "Country");
export const getAllCountries = getAllGenericItems(Country, "Country");
export const getCountryById = getGenericItemById(Country, "Country");
export const updateCountry = updateGenericItem(Country, "Country");
export const deleteCountry = deleteGenericItem(Country, "Country");

// Billing Currency
export const createBillingCurrency = createGenericItem(BillingCurrency, "Billing currency");
export const getAllBillingCurrencies = getAllGenericItems(BillingCurrency, "Billing currency");
export const getBillingCurrencyById = getGenericItemById(BillingCurrency, "Billing currency");
export const updateBillingCurrency = updateGenericItem(BillingCurrency, "Billing currency");
export const deleteBillingCurrency = deleteGenericItem(BillingCurrency, "Billing currency");

// Specific Lab
export const createSpecificLab = createGenericItem(SpecificLab, "Specific lab");
export const getAllSpecificLabs = getAllGenericItems(SpecificLab, "Specific lab");
export const getSpecificLabById = getGenericItemById(SpecificLab, "Specific lab");
export const updateSpecificLab = updateGenericItem(SpecificLab, "Specific lab");
export const deleteSpecificLab = deleteGenericItem(SpecificLab, "Specific lab");

// Brand
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

// Category
export const createCategory = async (req, res) => {
  try {
    const { name, brand, description } = req.body;

    if (!name || !brand) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Category name and brand are required");
    }

    if (!mongoose.Types.ObjectId.isValid(brand)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Invalid brand format");
    }

    const brandExists = await Brand.findOne({ _id: brand, tenantId: req.user.tenantId });
    if (!brandExists) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Brand not found");
    }

    const existingCategory = await Category.findOne({ name, brand, tenantId: req.user.tenantId });
    if (existingCategory) {
      return sendErrorResponse(res, 409, "DUPLICATE_ERROR", "Category already exists for this brand");
    }

    const category = await Category.create({
      name,
      brand,
      description,
      createdBy: req.user.id,
      tenantId: req.user.tenantId,
    });

    const populatedCategory = await Category.findOne({ _id: category._id, tenantId: req.user.tenantId }).populate('brand', 'name');

    return sendSuccessResponse(res, 201, populatedCategory, "Category created successfully");
  } catch (error) {
    console.error("Create Category Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to create category");
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const { brand, isActive } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (brand) filter.brand = brand;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const categories = await Category.find(filter).populate('brand', 'name').sort({ name: 1 });

    return sendSuccessResponse(res, 200, categories, "Categories retrieved successfully");
  } catch (error) {
    console.error("Get All Categories Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve categories");
  }
};

export const getCategoriesByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;

    const brand = await Brand.findOne({ _id: brandId, tenantId: req.user.tenantId });
    if (!brand) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Brand not found");
    }

    const categories = await Category.find({ brand: brandId, isActive: true, tenantId: req.user.tenantId })
      .select('name description')
      .sort({ name: 1 });

    return sendSuccessResponse(
      res,
      200,
      { brand: brand.name, categories },
      "Categories retrieved successfully"
    );
  } catch (error) {
    console.error("Get Categories by Brand Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve categories");
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({ _id: id, tenantId: req.user.tenantId }).populate('brand', 'name description');

    if (!category) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Category not found");
    }

    return sendSuccessResponse(res, 200, category, "Category retrieved successfully");
  } catch (error) {
    console.error("Get Category Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve category");
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, description, isActive } = req.body;

    const category = await Category.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!category) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Category not found");
    }

    if (brand && brand !== category.brand.toString()) {
      const brandExists = await Brand.findOne({ _id: brand, tenantId: req.user.tenantId });
      if (!brandExists) {
        return sendErrorResponse(res, 404, "NOT_FOUND", "Brand not found");
      }
      category.brand = brand;
    }

    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({
        name,
        brand: category.brand,
        tenantId: req.user.tenantId,
        _id: { $ne: id }
      });
      if (existingCategory) {
        return sendErrorResponse(res, 409, "DUPLICATE_ERROR", "Category name already exists for this brand");
      }
      category.name = name;
    }

    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    const updatedCategory = await Category.findOne({ _id: id, tenantId: req.user.tenantId }).populate('brand', 'name');

    return sendSuccessResponse(res, 200, updatedCategory, "Category updated successfully");
  } catch (error) {
    console.error("Update Category Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to update category");
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });
    if (!category) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Category not found");
    }

    return sendSuccessResponse(res, 200, null, "Category deleted successfully");
  } catch (error) {
    console.error("Delete Category Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to delete category");
  }
};

// Business Type
export const createBusinessType = createGenericItem(BusinessType, "Business type");
export const getAllBusinessTypes = getAllGenericItems(BusinessType, "Business type");
export const getBusinessTypeById = getGenericItemById(BusinessType, "Business type");
export const updateBusinessType = updateGenericItem(BusinessType, "Business type");
export const deleteBusinessType = deleteGenericItem(BusinessType, "Business type");
