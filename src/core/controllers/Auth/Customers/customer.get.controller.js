import { sendErrorResponse, sendSuccessResponse } from "../../../../Utils/response/responseHandler.js";
import Customer from "../../../../models/Auth/Customer.js";
import dotenv from "dotenv";
import CustomerDraft from "../../../../models/Auth/CustomerDraft.js";
import mongoose from "mongoose";
dotenv.config();

export const getCustomerProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return sendErrorResponse(
        res,
        404,
        "USER_NOT_FOUND",
        "Customer not found",
      );
    }

    return sendSuccessResponse(res, 200, customer, "customer profile fetch successfully");
  } catch (error) {
    console.error("Get customer profile error:", error);
    return sendErrorResponse(
      res,
      500,
      "INTERNAL_ERROR",
      "Internal server error",
    );
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });

    if (!customer) {
      return sendErrorResponse(res, 404, "USER_NOT_FOUND", "Customer not found");
    }

    return sendSuccessResponse(res, 200, customer, "customer profile fetch successfully");
  } catch (error) {
    console.error("Get customer profile error:", error);
    return sendErrorResponse(
      res,
      500,
      "INTERNAL_ERROR",
      "Internal server error",
    );
  }
};



export const getDraftCustomers = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await CustomerDraft.findOne({ _id: customerId, tenantId: req.user.tenantId });

    if (!customer) {
      return sendErrorResponse(res, 404, "USER_NOT_FOUND", "Customer not found");
    }

    return sendSuccessResponse(res, 200, customer, "customer profile fetch successfully");
  } catch (error) {
    console.error("Get customer profile error:", error);
    return sendErrorResponse(
      res,
      500,
      "INTERNAL_ERROR",
      "Internal server error",
    );
  }
};

export const getAllCustomers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const {
      businessType,
      customerID,
      status = "active",
      createdByDepartment,
      zone,
      specificBrand,
      specificCategory,
      fromDate,
      toDate,
      search
    } = req.query;

    const customerIDTerm = Array.isArray(customerID) ? customerID[0] : customerID;

    const searchTerm = Array.isArray(search) ? search[0] : search;
    const businessTypeTerm = Array.isArray(businessType) ? businessType[0] : businessType;
    const statusTerm = Array.isArray(status) ? status[0] : status;
    const createdByDepartmentTerm = Array.isArray(createdByDepartment) ? createdByDepartment[0] : createdByDepartment;
    const zoneTerm = Array.isArray(zone) ? zone[0] : zone;
    const specificBrandTerm = Array.isArray(specificBrand) ? specificBrand[0] : specificBrand;
    const specificCategoryTerm = Array.isArray(specificCategory) ? specificCategory[0] : specificCategory;

    const userDepartment = req.user?.Department?.name || req.user?.Department;
    const userEmployeeType = req.user?.EmployeeType;

    let query = {};
    query.tenantId = req.user.tenantId;

    const isSalesHead = Array.isArray(req.user?.subRoles) && req.user.subRoles.some(r => r.code === "SALES_HEAD");

    if (userDepartment === "SALES" &&  userEmployeeType === "EMPLOYEE" &&  !isSalesHead) {
      query.createdBy = req.user.id;
    }

    if (customerIDTerm) {
      if (!mongoose.Types.ObjectId.isValid(customerIDTerm)) {
        return sendErrorResponse(res, 400, "INVALID_CUSTOMER_ID", "Invalid customer ID");
      }
      query._id = new mongoose.Types.ObjectId(customerIDTerm);
    }

    if (searchTerm) {
      const searchConditions = [];

      if (!isNaN(searchTerm)) {
        searchConditions.push({ serialNumber: Number(searchTerm) });
      }

      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }

      searchConditions.push({ ownerName:     { $regex: searchTerm, $options: "i" } });
      searchConditions.push({ customerCode:  { $regex: searchTerm, $options: "i" } });
      searchConditions.push({ shopName:      { $regex: searchTerm, $options: "i" } });
      searchConditions.push({ mobileNo1:     { $regex: searchTerm, $options: "i" } });
      searchConditions.push({ mobileNo2:     { $regex: searchTerm, $options: "i" } });
      searchConditions.push({ businessEmail: { $regex: searchTerm, $options: "i" } });
      searchConditions.push({ "salesPerson.name": { $regex: searchTerm, $options: "i" } });

      query.$or = searchConditions;
    }

    if (businessTypeTerm) {
      query["BusinessType.refId"] = businessTypeTerm;
    }

    if (statusTerm) {
      if (statusTerm.toLowerCase() === "active") {
        query["status.isActive"] = true;
      } else if (statusTerm.toLowerCase() === "inactive") {
        query["status.isActive"] = false;
      }
    }

    if (createdByDepartmentTerm) {
      query.createdByDepartment = createdByDepartmentTerm.toUpperCase();
    }

    if (zoneTerm) {
      query["zone.refId"] = zoneTerm;
    }

    if (specificBrandTerm) {
      query["brandCategories.brandId"] = specificBrandTerm;
    }

    if (specificCategoryTerm) {
      query["brandCategories.categories.categoryId"] = specificCategoryTerm;
    }

    let startDate, endDate;

    if (fromDate) {
      startDate = new Date(fromDate);

      if (isNaN(startDate.valueOf())) {
        return sendErrorResponse(
          res,
          400,
          "INVALID_DATE",
          "fromDate is not a valid date"
        );
      }

      startDate.setHours(0, 0, 0, 0);
    }

    if (toDate) {
      endDate = new Date(toDate);

      if (isNaN(endDate.valueOf())) {
        return sendErrorResponse(
          res,
          400,
          "INVALID_DATE",
          "toDate is not a valid date"
        );
      }

      endDate.setHours(23, 59, 59, 999);
    }

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    console.log("querys : ", query);

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Customer.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalCustomers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(
      res,
      200,
      { customers, pagination },
      "Customers retrieved successfully"
    );
  } catch (error) {
    console.error("Get filtered customers error:", error);

    return sendErrorResponse(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to retrieve customers"
    );
  }
};

export const getPendingTermsCustomers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const query = {
      tenantId: req.user.tenantId,
      "approvalWorkflow.salesHeadApprovalStatus": "APPROVED",
      "termsAndConditionsAccepted": false,
      "isBlacklisted": false,
      "status.isActive": true
    };

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .select("-password -emailOtp -mobileOtp")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalCustomers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { customers, pagination }, "Customers pending T&C acceptance retrieved successfully");
  } catch (error) {
    console.error("Get pending terms customers error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve customers pending T&C");
  }
};

export const getCorrectionRequiredCustomers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const userDepartment = req.user?.Department?.name || req.user?.Department;
    const userEmployeeType = req.user?.EmployeeType;

    let query = {
      tenantId: req.user.tenantId,
      "approvalWorkflow.financeApprovalStatus": 'MODIFICATION_REQUIRED'
    };

    if (userDepartment === 'SALES' && userEmployeeType !== 'SUPERADMIN') {
      query.createdBy = req.user.id;
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .populate('createdBy', 'username employeeName email Department')
        .populate('correctionRequest.requestedBy', 'username employeeName email Department')
        .sort({ 'correctionRequest.requestedAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalCustomers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(
      res,
      200,
      { customers, pagination },
      "Customers requiring corrections retrieved successfully"
    );
  } catch (error) {
    console.error("Get correction required customers error:", error);
    return sendErrorResponse(
      res,
      500,
      "INTERNAL_ERROR",
      "Internal server error while fetching correction required customers"
    );
  }
};
