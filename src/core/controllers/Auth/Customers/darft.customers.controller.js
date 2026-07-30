import mongoose from "mongoose";
import { sendErrorResponse, sendSuccessResponse } from "../../../../Utils/response/responseHandler.js";
import Customer from "../../../../models/Auth/Customer.js";
import customerDraftSchema from "../../../../models/Auth/CustomerDraft.js";
import dotenv from "dotenv";
dotenv.config();

export const customerDraftRegistration = async (req, res) => {
  try {
    const {
      businessType,
      businessTypeRefId,
      zone,
      zoneRefId,
      brandCategories,
      businessEmail,
      shopName,
      ownerName,
      mobileNo1,
      mobileNo2,
      gstType,
      gstTypeRefId,
      creditDays,
      creditDaysRefId,
      creditLimit,
      billToAddress,
      isGSTRegistered,
      gstNumber,
      gstCertificateImg,
      panCard,
      aadharCard,
      panCardImg,
      aadharCardImg,
      salesPerson,
      salesPersonRefId,
      customerpassword,
      plant,
      plantRefId,
      fittingCenter,
      fittingCenterRefId,
      courierName,
      courierNameRefId,
      courierTime,
      courierTimeRefId,
      specificLab,
      specificLabRefId,
      yearOfEstablishment,
      proposedDiscount,
      currentlyDealtBrands,
      minSalesValue,
      finalDiscount,
      proprietorName,
      firmName,
      chequeDetails,
      chequeRemark,
      billingCycle,
      billingMode,
      customerShipToDetails,
    } = req.body;

    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;
    const isSalesDepartment = userDepartment === "SALES";
    const isFinanceDepartment = userDepartment === "FINANCE" || userEmployeeType === "SUPERADMIN";

    if (billToAddress && typeof billToAddress !== 'object') {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "billToAddress must be an object");
    }

    const normalizedEmail = businessEmail?.trim().toLowerCase();
    console.log("normalizedEmail :  ", normalizedEmail);

    if (normalizedEmail) {
      const existingDraft = await customerDraftSchema.findOne({ 
        businessEmail: normalizedEmail,
        tenantId: req.user.tenantId,
        isDeleted: false 
      });

      if (existingDraft) {
        return sendErrorResponse(res, 409, "DRAFT_EXISTS", "Draft customer with this business email already exists");
      }

      const existingCustomer = await Customer.findOne({ 
        businessEmail: normalizedEmail,
        tenantId: req.user.tenantId,
      });

      if (existingCustomer) {
        return sendErrorResponse(res, 409, "CUSTOMER_EXISTS", "Customer with this business email already exists");
      }
    }

    const customerData = {
      // Customer Info.
      shopName: shopName?.trim(),
      ownerName: ownerName?.trim(),
      businessType: businessTypeRefId ? {
        name: businessType,
        refId: businessTypeRefId
      } : undefined,
      orderMode: "Online",
      mobileNo1,
      mobileNo2,
      businessEmail: businessEmail && businessEmail.trim() ? businessEmail.toLowerCase().trim() : undefined,
      isGSTRegistered: isGSTRegistered,
      gstNumber: isGSTRegistered ? gstNumber : undefined,
      gstType: isGSTRegistered && gstType ? {
        name: gstType,
        refId: gstTypeRefId
      } : undefined,
      gstCertificateImg: isGSTRegistered ? gstCertificateImg : undefined,
      panCard: !isGSTRegistered ? panCard : undefined,
      aadharCard: !isGSTRegistered ? aadharCard : undefined,
      panCardImg: !isGSTRegistered ? panCardImg : undefined,
      aadharCardImg: !isGSTRegistered ? aadharCardImg : undefined,

      // Address
      billToAddress: billToAddress ? {
        branchName: billToAddress.branchName?.trim(),
        customerContactName: billToAddress.customerContactName?.trim(),
        customerContactNumber: billToAddress.customerContactNumber?.trim(),
        country: billToAddress.country,
        state: billToAddress.state,
        zipCode: billToAddress.zipCode,
        city: billToAddress.city?.trim(),
        address: billToAddress.address?.trim(),
        billingCurrency: billToAddress.billingCurrency,
        billingMode: billToAddress.billingMode,
        createdBy: req.user.id,
      } : undefined,

      // Customer Registration
      password: customerpassword,
      brandCategories: brandCategories
        ? brandCategories
          .filter(brand => brand.brandId && brand.brandName && brand.brandId !== "" && brand.brandName !== "")
          .map(brand => ({
            brandId: brand.brandId,
            brandName: brand.brandName,
            categories: brand.categories
              ? brand.categories.filter(cat => cat.categoryId && cat.categoryName && cat.categoryId !== "" && cat.categoryName !== "")
              : []
          }))
        : undefined,

      zone: zone && zoneRefId ? {
        name: zone,
        refId: zoneRefId,
      } : undefined,

      salesPerson: salesPerson && salesPersonRefId ? {
        name: salesPerson,
        refId: salesPersonRefId,
      } : undefined,

      specificLab: specificLab && specificLabRefId ? {
        name: specificLab,
        refId: specificLabRefId,
      } : undefined,

      fittingCenter: fittingCenter && fittingCenterRefId ? {
        name: fittingCenter,
        refId: fittingCenterRefId,
      } : undefined,

      plant: plant && plantRefId ? {
        name: plant,
        refId: plantRefId,
      } : undefined,

      creditLimit: creditLimit || 0,

      creditDays: creditDays && creditDaysRefId ? {
        name: creditDays,
        refId: creditDaysRefId,
      } : undefined,

      courierName: courierName && courierNameRefId ? {
        name: courierName,
        refId: courierNameRefId,
      } : undefined,

      courierTime: courierTime && courierTimeRefId ? {
        name: courierTime,
        refId: courierTimeRefId,
      } : undefined,

      // System Internal details
      dcWithoutValue: false,
      designation: "Customer",
      createdBy: req.user.id,
      createdByDepartment: userDepartment,
      tenantId: req.user.tenantId,
      status: {
        isActive: true,
        isSuspended: false,
      },

      // Business Details
      yearOfEstablishment: yearOfEstablishment || undefined,
      proposedDiscount: proposedDiscount || undefined,
      currentlyDealtBrands: currentlyDealtBrands ? currentlyDealtBrands.trim() : undefined,
      minSalesValue: minSalesValue || undefined,
      finalDiscount: finalDiscount,

      // Sales Person Input Fields
      proprietorName: proprietorName,
      firmName: firmName ? firmName.trim() : undefined,
      chequeDetails: Array.isArray(chequeDetails)
        ? chequeDetails.filter(c => (c.chequeNumber && c.chequeNumber.trim() !== "") || (c.chequeImage && c.chequeImage.trim() !== ""))
        : [],
      chequeRemark: chequeRemark || undefined,
      billingCycle: billingCycle,
      billingMode: billingMode,

      customerShipToDetails: customerShipToDetails && Array.isArray(customerShipToDetails)
        ? customerShipToDetails.map((shipTo) => ({
            branchName: shipTo.branchName?.trim(),
            address: shipTo.address?.trim(),
            city: shipTo.city?.trim(),
            state: shipTo.state,
            country: shipTo.country,
            zipCode: shipTo.zipCode,
            billingCurrency: shipTo.billingCurrency,
            billingMode: shipTo.billingMode,
            customerContactName: shipTo.customerContactName?.trim(),
            customerContactNumber: shipTo.customerContactNumber,
          }))
        : undefined,

      // Workflow Status
      approvalWorkflow: {
        financeApprovalStatus: isSalesDepartment ? "PENDING" : "APPROVED",
        financeApprovedBy: isFinanceDepartment ? req.user.id : undefined,
        financeApprovedAt: isFinanceDepartment ? new Date() : undefined,
        salesHeadApprovalStatus: "PENDING",
      },
      isBlacklisted: false,
      termsAndConditionsAccepted: false,
    };

    console.log("customerDraftData  : ", customerData);

    const customer = await customerDraftSchema.create(customerData);
    const customerObj = customer.toObject();
    delete customerObj.password;

    const message = "Draft customer registered successfully."

    return sendSuccessResponse(res, 201, { customer: customerObj }, message);
  } catch (error) {
    console.error("Customer draft registration error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(
        res,
        400,
        "MONGOOSE_VALIDATION_ERROR",
        messages.join(", "),
      );
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return sendErrorResponse(
        res,
        409,
        "DUPLICATE_FIELD",
        `${field} already exists`,
      );
    }
    return sendErrorResponse(
      res,
      500,
      "INTERNAL_ERROR",
      "Customer draft registration failed",
    );
  }
};

export const getAllDraftCustomers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const { 
      shopName, 
      businessType, 
      createdByDepartment, 
      zone, 
      specificBrand, 
      specificCategory, 
      fromDate, 
      toDate 
    } = req.query;

    let query = { isDeleted: false, tenantId: req.user.tenantId };

    if (shopName) {
      query.shopName = { $regex: shopName, $options: 'i' };
    }

    if (businessType) {
      query['businessType.refId'] = businessType;
    }

    if (createdByDepartment) {
      query.createdByDepartment = createdByDepartment.toUpperCase();
    }

    if (zone) {
      query['zone.refId'] = zone;
    }

    if (specificBrand) {
      query['brandCategories.brandId'] = specificBrand;
    }

    if (specificCategory) {
      query['brandCategories.categories.categoryId'] = specificCategory;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    console.log("query : ", query);

    const [customers, total] = await Promise.all([
      customerDraftSchema
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      customerDraftSchema.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalCustomers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { customers, pagination }, 'Draft customers retrieved successfully');

  } catch (error) {
    console.error('Get draft customers error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve draft customers');
  }
};

export const getMyDraftCustomers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    const { 
      shopName, 
      businessType, 
      status, 
      createdByDepartment, 
      zone, 
      specificBrand, 
      specificCategory, 
      fromDate, 
      toDate 
    } = req.query;

    let query = { createdBy: userId, isDeleted: false, tenantId: req.user.tenantId };

    if (shopName) {
      query.shopName = { $regex: shopName, $options: 'i' };
    }

    if (businessType) {
      query['businessType.refId'] = businessType;
    }

    if (status) {
      if (status.toLowerCase() === 'active') {
        query['status.isActive'] = true;
        query['status.isSuspended'] = false;
      } else if (status.toLowerCase() === 'suspended') {
        query['status.isSuspended'] = true;
      } else if (status.toLowerCase() === 'inactive') {
        query['status.isActive'] = false;
      }
    }

    if (createdByDepartment) {
      query.createdByDepartment = createdByDepartment.toUpperCase();
    }

    if (zone) {
      query['zone.refId'] = zone;
    }

    if (specificBrand) {
      query['brandCategories.brandId'] = specificBrand;
    }

    if (specificCategory) {
      query['brandCategories.categories.categoryId'] = specificCategory;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const [customers, total] = await Promise.all([
      customerDraftSchema
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      customerDraftSchema.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalCustomers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { customers, pagination }, 'Draft customers retrieved successfully');

  } catch (error) {
    console.error('Get draft customers error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve draft customers');
  }
};


export const updateDraftCustomer = async (req, res) => {
  try {
    const { draftId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    const draftCustomer = await customerDraftSchema.findOne({ _id: draftId, tenantId: req.user.tenantId });

    if (!draftCustomer) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Draft customer not found');
    }

    // Check if user has permission to update
    const isCreator = draftCustomer.createdBy?.toString() === userId?.toString();
    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    if (!isCreator && !isFinanceDepartment) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to update this draft');
    }

    // Check if email is being changed and if it already exists
    if (updateData?.businessEmail && updateData?.businessEmail.toLowerCase() !== draftCustomer.businessEmail) {
      const [existingCustomer, existingDraft] = await Promise.all([
        Customer.findOne({ businessEmail: updateData?.businessEmail.toLowerCase(), tenantId: req.user.tenantId }),
        customerDraftSchema.findOne({
          businessEmail: updateData?.businessEmail.toLowerCase(),
          tenantId: req.user.tenantId,
          _id: { $ne: draftId }
        })
      ]);

      if (existingCustomer || existingDraft) {
        return sendErrorResponse(res, 409, 'EMAIL_EXISTS', 'Business email already exists');
      }
    }

    // Prepare update object
    const updateFields = {};

    // Basic fields that can be updated by creator
    if (updateData?.shopName) updateFields.shopName = updateData?.shopName.trim();
    if (updateData?.ownerName) updateFields.ownerName = updateData?.ownerName.trim();
    if (updateData?.orderMode) updateFields.orderMode = updateData?.orderMode;
    if (updateData?.mobileNo1) updateFields.mobileNo1 = updateData?.mobileNo1;
    if (updateData?.mobileNo2) updateFields.mobileNo2 = updateData?.mobileNo2;
    if (updateData?.businessEmail) updateFields.businessEmail = updateData?.businessEmail.toLowerCase().trim();
    
    // Business details fields (can be updated by creator)
    if (updateData?.yearOfEstablishment !== undefined) updateFields.yearOfEstablishment = updateData?.yearOfEstablishment;
    if (updateData?.proposedDiscount !== undefined) updateFields.proposedDiscount = updateData?.proposedDiscount;
    if (updateData?.currentlyDealtBrands !== undefined) updateFields.currentlyDealtBrands = updateData?.currentlyDealtBrands?.trim();
    if (updateData?.minSalesValue !== undefined) updateFields.minSalesValue = updateData?.minSalesValue;
    if (updateData?.proprietorName) updateFields.proprietorName = updateData?.proprietorName.trim();
    if (updateData?.firmName) updateFields.firmName = updateData?.firmName.trim();
    if (updateData?.finalDiscount !== undefined) updateFields.finalDiscount = updateData?.finalDiscount;

    if (updateData?.businessType && updateData?.businessTypeRefId) {
      updateFields.businessType = {
        name: updateData?.businessType,
        refId: updateData?.businessTypeRefId
      };
    }

    if (updateData?.isGSTRegistered !== undefined) {
      updateFields.isGSTRegistered = updateData?.isGSTRegistered;

      if (updateData?.isGSTRegistered) {
        if (updateData?.gstNumber) updateFields.gstNumber = updateData?.gstNumber;
        if (updateData?.gstCertificateImg) updateFields.gstCertificateImg = updateData?.gstCertificateImg;
        if (updateData?.gstType && updateData?.gstTypeRefId) {
          updateFields.gstType = {
            name: updateData?.gstType,
            refId: updateData?.gstTypeRefId
          };
        }
        // Clear non-GST fields
        updateFields.panCard = undefined;
        updateFields.aadharCard = undefined;
        updateFields.panCardImg = undefined;
        updateFields.aadharCardImg = undefined;
      } else {
        if (updateData?.panCard) updateFields.panCard = updateData?.panCard;
        if (updateData?.aadharCard) updateFields.aadharCard = updateData?.aadharCard;
        if (updateData?.panCardImg) updateFields.panCardImg = updateData?.panCardImg;
        if (updateData?.aadharCardImg) updateFields.aadharCardImg = updateData?.aadharCardImg;
        // Clear GST fields
        updateFields.gstNumber = undefined;
        updateFields.gstCertificateImg = undefined;
        updateFields.gstType = undefined;
      }
    }

    if (updateData?.billToAddress && typeof updateData?.billToAddress === 'object') {
      updateFields.billToAddress = {
        branchName: updateData?.billToAddress.branchName?.trim(),
        customerContactName: updateData?.billToAddress.customerContactName?.trim(),
        customerContactNumber: updateData?.billToAddress.customerContactNumber?.trim(),
        country: updateData?.billToAddress.country,
        state: updateData?.billToAddress.state,
        zipCode: updateData?.billToAddress.zipCode,
        city: updateData?.billToAddress.city?.trim(),
        address: updateData?.billToAddress.address?.trim(),
        billingCurrency: updateData?.billToAddress.billingCurrency,
        billingMode: updateData?.billToAddress.billingMode,
        createdBy: draftCustomer.billToAddress?.createdBy || req.user.id,
        updatedBy: req.user.id,
      };
    }

    if (updateData?.customerShipToDetails && Array.isArray(updateData?.customerShipToDetails)) {
      updateFields.customerShipToDetails = updateData.customerShipToDetails.map((shipTo) => ({
        branchName: shipTo.branchName?.trim(),
        address: shipTo.address?.trim(),
        city: shipTo.city?.trim(),
        state: shipTo.state,
        country: shipTo.country,
        zipCode: shipTo.zipCode,
        billingCurrency: shipTo.billingCurrency,
        billingMode: shipTo.billingMode,
        customerContactName: shipTo.customerContactName?.trim(),
        customerContactNumber: shipTo.customerContactNumber,
      }));
    }

    // Finance-only fields
    if (isFinanceDepartment) {
      if (updateData?.customerpassword) {
        updateFields.password = updateData?.customerpassword;
      }

      if (updateData?.brandCategories) {
        updateFields.brandCategories = updateData?.brandCategories
          .filter(brand => brand.brandId && brand.brandName && brand.brandId !== "" && brand.brandName !== "")
          .map(brand => ({
            brandId: brand.brandId,
            brandName: brand.brandName,
            categories: brand.categories
              ? brand.categories.filter(cat => cat.categoryId && cat.categoryName && cat.categoryId !== "" && cat.categoryName !== "")
              : []
          }));
      }

      if (updateData?.zone && updateData?.zoneRefId) {
        updateFields.zone = {
          name: updateData?.zone,
          refId: updateData?.zoneRefId
        };
      }

      if (updateData?.salesPerson && updateData?.salesPersonRefId) {
        updateFields.salesPerson = {
          name: updateData?.salesPerson,
          refId: updateData?.salesPersonRefId
        };
      }

      if (updateData?.specificLab && updateData?.specificLabRefId) {
        updateFields.specificLab = {
          name: updateData?.specificLab,
          refId: updateData?.specificLabRefId
        };
      }

      if (updateData?.fittingCenter && updateData?.fittingCenterRefId) {
        updateFields.fittingCenter = {
          name: updateData?.fittingCenter,
          refId: updateData?.fittingCenterRefId
        };
      }

      if (updateData?.plant && updateData?.plantRefId) {
        updateFields.plant = {
          name: updateData?.plant,
          refId: updateData?.plantRefId
        };
      }

      if (updateData?.creditLimit !== undefined) {
        updateFields.creditLimit = updateData?.creditLimit;
      }

      if (updateData?.creditDays && updateData?.creditDaysRefId) {
        updateFields.creditDays = {
          name: updateData?.creditDays,
          refId: updateData?.creditDaysRefId
        };
      }

      if (updateData?.courierName && updateData?.courierNameRefId) {
        updateFields.courierName = {
          name: updateData?.courierName,
          refId: updateData?.courierNameRefId
        };
      }

      if (updateData?.courierTime && updateData?.courierTimeRefId) {
        updateFields.courierTime = {
          name: updateData?.courierTime,
          refId: updateData?.courierTimeRefId
        };
      }

      if (updateData?.chequeDetails && Array.isArray(updateData?.chequeDetails)) {
        updateFields.chequeDetails = updateData?.chequeDetails;
      }

      if (updateData?.billingCycle) {
        updateFields.billingCycle = updateData?.billingCycle;
      }

      if (updateData?.billingMode) {
        updateFields.billingMode = updateData?.billingMode;
      }
    }

    const updatedDraft = await customerDraftSchema.findOneAndUpdate(
      { _id: draftId, tenantId: req.user.tenantId },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    return sendSuccessResponse(res, 200, { customer: updatedDraft }, 'Draft customer updated successfully');

  } catch (error) {
    console.error('Update draft customer error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return sendErrorResponse(res, 409, 'DUPLICATE_FIELD', `${field} already exists`);
    }
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update draft customer');
  }
};

export const deactivateCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid customer ID format');
    }

    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    if (!isFinanceDepartment) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to delete this customer');
    }

    const user = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId, 'Status.isActive': true, isDeleted: false });
    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Customer not found or already deactivated');
    }

    user.status.isActive = false;
    user.status.isSuspended = true;
    user.status.suspensionReason = req?.body?.suspensionReason || 'N/A';
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user.id;
    await user.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Customer moved to recycle bin. Will be permanently deleted after 30 days');

  } catch (error) {
    console.error('Deactivate Customer Error:', error);

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to deactivate customer');
  }
};

export const deactivateDraftCustomer = async (req, res) => {
  try {
    const { draftId } = req.params;
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid draft customer ID format');
    }

    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    const draftCustomer = await customerDraftSchema.findOne({ _id: draftId, tenantId: req.user.tenantId, 'status.isActive': true, isDeleted: false });
    if (!draftCustomer) {
      return sendErrorResponse(res, 404, 'DRAFT_NOT_FOUND', 'Draft customer not found or already deactivated');
    }

    if (draftCustomer.createdBy.toString() !== req.user.id.toString() && !isFinanceDepartment) {
      return sendErrorResponse(
        res,
        403,
        'FORBIDDEN',
        'You do not have permission to delete this draft customer'
      );
    }

    draftCustomer.status.isActive = false;
    draftCustomer.status.isSuspended = true;
    draftCustomer.status.suspensionReason = req?.body?.suspensionReason || 'N/A';
    draftCustomer.isDeleted = true;
    draftCustomer.deletedAt = new Date();
    draftCustomer.deletedBy = req.user.id;
    await draftCustomer.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Draft customer moved to recycle bin. Will be permanently deleted after 30 days');

  } catch (error) {
    console.error('Deactivate Draft Customer Error:', error);

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to deactivate draft customer');
  }
};


export const restoreCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid customer ID format');
    }

    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    if (!isFinanceDepartment) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to restore customers');
    }

    const user = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId, isDeleted: true });
    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Customer not found in recycle bin');
    }

    // Check if 30 days have passed
    const daysSinceDeletion = Math.floor((new Date() - new Date(user.deletedAt)) / (1000 * 60 * 60 * 24));
    if (daysSinceDeletion > 30) {
      return sendErrorResponse(res, 400, 'EXPIRED', 'Cannot restore customer. More than 30 days have passed since deletion');
    }

    user.status.isActive = true;
    user.status.isSuspended = false;
    user.status.suspensionReason = null;
    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedBy = null;
    await user.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Customer restored successfully');

  } catch (error) {
    console.error('Restore Customer Error:', error);

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to restore customer');
  }
};

export const restoreDraftCustomer = async (req, res) => {
  try {
    const { draftId } = req.params;
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid draft customer ID format');
    }

    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    const draftCustomer = await customerDraftSchema.findOne({ _id: draftId, tenantId: req.user.tenantId, isDeleted: true });
    if (!draftCustomer) {
      return sendErrorResponse(res, 404, 'DRAFT_NOT_FOUND', 'Draft customer not found in recycle bin');
    }

    if (draftCustomer.createdBy.toString() !== req.user.id.toString() && !isFinanceDepartment) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to restore this draft customer');
    }

    // Check if 30 days have passed
    const daysSinceDeletion = Math.floor((new Date() - new Date(draftCustomer.deletedAt)) / (1000 * 60 * 60 * 24));
    if (daysSinceDeletion > 30) {
      return sendErrorResponse(res, 400, 'EXPIRED', 'Cannot restore draft. More than 30 days have passed since deletion');
    }

    draftCustomer.status.isActive = true;
    draftCustomer.status.isSuspended = false;
    draftCustomer.status.suspensionReason = null;
    draftCustomer.isDeleted = false;
    draftCustomer.deletedAt = null;
    draftCustomer.deletedBy = null;
    await draftCustomer.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Draft customer restored successfully');

  } catch (error) {
    console.error('Restore Draft Customer Error:', error);

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to restore draft customer');
  }
};

// GET ALL DELETED CUSTOMERS (RECYCLE BIN)
export const getDeletedCustomers = async (req, res) => {
  try {
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    if (!isFinanceDepartment) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to view deleted customers');
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const query = { isDeleted: true, tenantId: req.user.tenantId };

    const [deletedCustomers, total] = await Promise.all([
      Customer.find(query)
        .populate('deletedBy', 'employeeName username')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query)
    ]);

    const customersWithDaysLeft = deletedCustomers.map(customer => {
      const daysSinceDeletion = Math.floor((new Date() - new Date(customer.deletedAt)) / (1000 * 60 * 60 * 24));
      const daysLeft = 30 - daysSinceDeletion;
      
      return {
        ...customer,
        daysUntilPermanentDeletion: daysLeft > 0 ? daysLeft : 0,
        canRestore: daysLeft > 0
      };
    });

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalCustomers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { customers: customersWithDaysLeft, pagination }, 'Deleted customers retrieved successfully');

  } catch (error) {
    console.error('Get Deleted Customers Error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deleted customers');
  }
};

export const getDeletedDraftCustomers = async (req, res) => {
  try {
    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === 'SUPERADMIN' ? 'SUPERADMIN' : req.user?.Department?.name || req.user?.Department;

    const isFinanceDepartment = userDepartment === 'FINANCE' || userEmployeeType === 'SUPERADMIN';

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    let query = { isDeleted: true, tenantId: req.user.tenantId };
    if (!isFinanceDepartment) {
      query.createdBy = req.user.id;
    }

    const [deletedDrafts, total] = await Promise.all([
      customerDraftSchema.find(query)
        .populate('deletedBy', 'employeeName username')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      customerDraftSchema.countDocuments(query)
    ]);

    const draftsWithDaysLeft = deletedDrafts.map(draft => {
      const daysSinceDeletion = Math.floor((new Date() - new Date(draft.deletedAt)) / (1000 * 60 * 60 * 24));
      const daysLeft = 30 - daysSinceDeletion;
      
      return {
        ...draft,
        daysUntilPermanentDeletion: daysLeft > 0 ? daysLeft : 0,
        canRestore: daysLeft > 0
      };
    });

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalDrafts: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { drafts: draftsWithDaysLeft, pagination }, 'Deleted draft customers retrieved successfully');

  } catch (error) {
    console.error('Get Deleted Draft Customers Error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deleted draft customers');
  }
};
