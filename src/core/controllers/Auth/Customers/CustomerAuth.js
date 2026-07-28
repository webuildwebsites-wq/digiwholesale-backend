import {
  sendErrorResponse,
  sendTokenResponse,
  sendSuccessResponse,
} from "../../../../Utils/response/responseHandler.js";
import {
  generateToken,
  generateRefreshToken,
} from "../../../../Utils/Auth/tokenUtils.js";
import {
  generateCustomerCode,
} from "../../../../Utils/Auth/customerAuthUtils.js";
import Customer from "../../../../models/Auth/Customer.js";
import customerDraftSchema from "../../../../models/Auth/CustomerDraft.js";
import Location from "../../../../models/Location/Location.js";
import SpecificLab from "../../../../models/Product/SpecificLab.js";
import Plant from "../../../../models/Product/Plant.js";
import FittingCenter from "../../../../models/Product/FittingCenter.js";
import CreditDay from "../../../../models/Product/CreditDay.js";
import CourierName from "../../../../models/Product/CourierName.js";
import CourierTime from "../../../../models/Product/CourierTime.js";
import BusinessType from "../../../../models/Product/BusinessType.js"
import GSTType from "../../../../models/Product/GSTType.js";
import employeeSchema from "../../../../models/Auth/Employee.js";
import { sendEmail } from "../../../../core/config/Email/emailService.js";
import ResetPasswordTemplate from "../../../../Utils/Mail/ResetPasswordTemplate.js";
import { generateResetToken, verifyResetToken, decodeUidb36 } from "../../../../Utils/Auth/passwordResetUtils.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

export const customerLogin = async (req, res) => {
  try {
    const { loginId, password, tenantId } = req.body;

    if (!loginId || !password) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Please provide login ID (email or customer code) and password",);
    }

    const query = {
      $or: [
        { businessEmail: loginId.toLowerCase() },
        { customerCode: loginId.toUpperCase() }
      ],
      'status.isActive': true,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const customer = await Customer.findOne(query).select("+password -emailOtp -emailOtpExpires -mobileOtp -mobileOtpExpires -gstNumber -gstCertificateImg -panCard -panCardImg -aadharCard -aadharCardImg -isLocked -failedLoginAttempts -lockUntil -createdByDepartment -approvalStatus");

    if (!customer) {
      return sendErrorResponse(res, 422, "INVALID_CREDENTIALS", "Invalid credentials or account is inactive",);
    }

    if (!customer.tenantId) {
      return sendErrorResponse(res, 403, "NO_TENANT", "Account is not associated with any workspace. Please contact support.",);
    }

    if (customer.isLocked) {
      return sendErrorResponse(res, 423, "ACCOUNT_LOCKED", "Account is temporarily locked due to too many failed login attempts",);
    }

    if (customer.status.isSuspended) {
      return sendErrorResponse(res, 423, "ACCOUNT_SUSPENDED", `Account is suspended: ${customer.status.suspensionReason}`,);
    }

    const isMatch = await customer.comparePassword(password);

    if (!isMatch) {
      return sendErrorResponse(res, 422, "INVALID_CREDENTIALS", "Invalid credentials",);
    }
    customer.lastLogin = new Date();
    await customer.save({ validateBeforeSave: false });
    return sendTokenResponse(customer, 200, res, "CUSTOMER", generateToken, generateRefreshToken);

  } catch (error) {
    console.error("Customer login error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Internal server error during login");
  }
};

export const customerBasicRegistration = async (req, res) => {
  try {
    const {
      businessType,
      businessTypeRefId,
      zone,
      zoneRefId,
      brandCategories,
      brands,
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
      draftCustomerId,
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
      customerShipToDetails
    } = req.body;

    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = userEmployeeType === "SUPERADMIN" ? "SUPERADMIN" : req.user?.Department?.name || req.user?.Department;
    const isSalesDepartment = userDepartment === "SALES";
    const isFinanceDepartment = userDepartment === "FINANCE" || userEmployeeType === "SUPERADMIN";

    if (draftCustomerId && !mongoose.Types.ObjectId.isValid(draftCustomerId)) {
      return sendErrorResponse(res, 400, "INVALID_ID", "Invalid draft customer ID format");
    }

    if (!businessType || !shopName || !ownerName || !businessEmail) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "businessType, shopName, ownerName, businessEmail and orderMode are required");
    }

    if (!salesPerson || !salesPersonRefId) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "salesPerson is required");
    }

    if (!billToAddress || typeof billToAddress !== 'object') {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Bill to address is required");
    }

    if (!billToAddress.branchName || !billToAddress.customerContactName || !billToAddress.customerContactNumber || !billToAddress.country || !billToAddress.state || !billToAddress.city || !billToAddress.zipCode || !billToAddress.address || !billToAddress.billingCurrency || !billToAddress.billingMode) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "All bill to address fields are required (branchName, customerContactName, customerContactNumber, country, state, city, zipCode, address, billingCurrency, billingMode)");
    }

    if (isGSTRegistered === true) {
      if (!gstNumber || !gstType || !gstCertificateImg) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "gstNumber, gstType and gstCertificateImg are required when GST registered");
      }
    } else {
      if (!panCard || !aadharCard || !panCardImg || !aadharCardImg) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "panCard, aadharCard and their images are required when not GST registered");
      }
    }

    if (yearOfEstablishment !== undefined && yearOfEstablishment !== null) {
      const currentYear = new Date().getFullYear();
      if (yearOfEstablishment < 1900 || yearOfEstablishment > currentYear) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", `yearOfEstablishment must be between 1900 and ${currentYear}`);
      }
    }

    if (proposedDiscount !== undefined && proposedDiscount !== null) {
      if (proposedDiscount < 0 || proposedDiscount > 100) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "proposedDiscount must be between 0 and 100");
      }
    }

    if (finalDiscount !== undefined && finalDiscount !== null) {
      if (finalDiscount < 0 || finalDiscount > 100) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "proposedDiscount must be between 0 and 100");
      }
    }

    if (minSalesValue !== undefined && minSalesValue !== null) {
      if (minSalesValue < 0) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "minSalesValue must be greater than or equal to 0");
      }
    }

    if (!proprietorName || proprietorName.trim() === "") {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "proprietorName is required");
    }

    if (isGSTRegistered && (!firmName || firmName.trim() === "")) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "firmName is required when GST type is 'Registered'",
      );
    }

    if (chequeDetails !== undefined && chequeDetails !== null) {
      if (!Array.isArray(chequeDetails)) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "chequeDetails must be an array");
      }

      if (chequeDetails.length > 0 && chequeDetails.length !== 3) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Exactly 3 cheque entries are required");
      }

      for (let i = 0; i < chequeDetails.length; i++) {
        const cheque = chequeDetails[i];
        const hasNumber = cheque.chequeNumber && cheque.chequeNumber.trim() !== "";
        const hasImage = cheque.chequeImage && cheque.chequeImage.trim() !== "";
        if ((hasNumber && !hasImage) || (!hasNumber && hasImage)) {
          return sendErrorResponse(res, 400, "VALIDATION_ERROR", `chequeDetails[${i}]: both chequeNumber and chequeImage are required together`);
        }
      }
    }

    // if chequeDetails not provided, chequeRemark is required
    const noChequeProvided = !chequeDetails || !Array.isArray(chequeDetails) ||
      chequeDetails.every(c => (!c.chequeNumber || c.chequeNumber.trim() === "") && (!c.chequeImage || c.chequeImage.trim() === ""));

    if (noChequeProvided && (!chequeRemark || chequeRemark.trim() === "")) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "chequeRemark is required when chequeDetails are not provided");
    }

    if (!billingCycle || !['7_days', '15_days', 'end_of_month', 'custom'].includes(billingCycle)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "billingCycle must be one of: 7_days, 15_days, end_of_month, or custom");
    }

    if (!billingMode || !['Direct', 'DC'].includes(billingMode)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "billingMode must be either 'Direct' or 'DC'");
    }

    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

    const requiredRefIds = [
      { name: "BusinessTypeRefId", value: businessTypeRefId },
      { name: "salesPersonRefId", value: salesPersonRefId },
      { name: "zoneRefId", value: zoneRefId },
      { name: "gstTypeRefId", value: gstTypeRefId },
      { name: "creditDaysRefId", value: creditDaysRefId },
    ];

    for (const field of requiredRefIds) {
      if (!field.value) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${field.name} is required for FINANCE department`);
      }
      if (!isValidObjectId(field.value)) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${field.name} must be a valid ObjectId (24 hex characters)`,);
      }
    }

    // if (!brandCategories || !Array.isArray(brandCategories) || brandCategories.length === 0) {
    //   return sendErrorResponse(
    //     res,
    //     400,
    //     "VALIDATION_ERROR",
    //     "brandCategories array with at least one brand is required for FINANCE department",
    //   );
    // }
    if (businessTypeRefId && !isValidObjectId(businessTypeRefId)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", `BusinessTypeRefId must be a valid ObjectId (24 hex characters)`);
    }

    const existingCustomer = await Customer.findOne({
      businessEmail: businessEmail.toLowerCase(),
      tenantId: req.user.tenantId,
    });

    if (existingCustomer) {
      return sendErrorResponse(res, 409, "CUSTOMER_EXISTS", "Customer with this business email already exists");
    }

    // Validate BusinessType
    if (businessTypeRefId && businessType) {
      const businessTypeDoc = await BusinessType.findById(businessTypeRefId);
      if (!businessTypeDoc) {
        return sendErrorResponse(res, 404, "INVALID_REF_ID", `BusinessType with refId ${businessTypeRefId} does not exist`);
      }
      if (businessTypeDoc.name !== businessType) {
        return sendErrorResponse(res, 400, "NAME_MISMATCH", `Incorrect BusinessType name for refId ${businessTypeRefId}. Expected: ${businessTypeDoc.name}, Received: ${businessType}`);
      }
    }

    // Validate zone
    if (zoneRefId && zone) {
      const location = await Location.findById(zoneRefId);
      if (!location) {
        return sendErrorResponse(res, 404, "INVALID_REF_ID", `Zone with refId ${zoneRefId} does not exist`);
      }
      if (location.zone !== zone.toUpperCase()) {
        return sendErrorResponse(res, 400, "NAME_MISMATCH", `Incorrect zone name for refId ${zoneRefId}. Expected: ${location.zone}, Received: ${zone}`);
      }
    }

    // Validate creditDays
    if (creditDaysRefId && creditDays) {
      const creditDayDoc = await CreditDay.findById(creditDaysRefId);
      if (!creditDayDoc) {
        return sendErrorResponse(res, 404, "INVALID_REF_ID", `CreditDays with refId ${creditDaysRefId} does not exist`);
      }
      if (creditDayDoc.days.toString() !== creditDays.toString()) {
        return sendErrorResponse(res, 400, "NAME_MISMATCH", `Incorrect creditDays value for refId ${creditDaysRefId}. Expected: ${creditDayDoc.days}, Received: ${creditDays}`);
      }
    }

    // Validate gstType
    if (gstTypeRefId && gstType) {
      const gstTypeDoc = await GSTType.findById(gstTypeRefId);
      if (!gstTypeDoc) {
        return sendErrorResponse(res, 404, "INVALID_REF_ID", `GSTType with refId ${gstTypeRefId} does not exist`);
      }
      if (gstTypeDoc.name !== gstType) {
        return sendErrorResponse(res, 400, "NAME_MISMATCH", `Incorrect gstType name for refId ${gstTypeRefId}. Expected: ${gstTypeDoc.name}, Received: ${gstType}`);
      }
    }

    // Validate salesPerson
    if (salesPersonRefId && salesPerson) {
      const salesPersonDoc = await employeeSchema.findById(salesPersonRefId);
      if (!salesPersonDoc) {
        return sendErrorResponse(res, 404, "INVALID_REF_ID", `SalesPerson with refId ${salesPersonRefId} does not exist`);
      }
      if (salesPersonDoc.employeeName !== salesPerson) {
        return sendErrorResponse(res, 400, "NAME_MISMATCH", `Incorrect salesPerson name for refId ${salesPersonRefId}. Expected: ${salesPersonDoc.employeeName}, Received: ${salesPerson}`);
      }
    }

    let generatedCustomerCode = null;
    let customerCode = generateCustomerCode(shopName);
    let codeExists = true;

    while (codeExists) {
      const existing = await Customer.findOne({ customerCode });
      if (!existing) {
        codeExists = false;
        generatedCustomerCode = customerCode;
      } else {
        customerCode = generateCustomerCode(shopName);
      }
    }

    const customerData = {
      // Customer Info.
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      businessType: businessTypeRefId ? {
        name: businessType,
        refId: businessTypeRefId,
      } : undefined,
      orderMode: "Online",
      mobileNo1,
      mobileNo2,
      businessEmail: businessEmail.toLowerCase().trim(),
      isGSTRegistered: isGSTRegistered,
      gstNumber: isGSTRegistered ? gstNumber : undefined,
      gstType:
        isGSTRegistered && gstType
          ? {
            name: gstType,
            refId: gstTypeRefId,
          }
          : undefined,
      gstCertificateImg: isGSTRegistered ? gstCertificateImg : undefined,
      panCard: !isGSTRegistered ? panCard : undefined,
      aadharCard: !isGSTRegistered ? aadharCard : undefined,
      panCardImg: !isGSTRegistered ? panCardImg : undefined,
      aadharCardImg: !isGSTRegistered ? aadharCardImg : undefined,

      // Account Status
      status: {
        isActive: false,
        isSuspended: false,
      },

      // BillToAddress
      billToAddress: {
        branchName: billToAddress?.branchName?.trim(),
        customerContactName: billToAddress?.customerContactName?.trim(),
        customerContactNumber: billToAddress?.customerContactNumber?.trim(),
        country: billToAddress?.country,
        state: billToAddress?.state,
        zipCode: billToAddress?.zipCode,
        city: billToAddress?.city?.trim(),
        address: billToAddress?.address?.trim(),
        billingCurrency: billToAddress?.billingCurrency,
        billingMode: billToAddress?.billingMode,
        createdBy: req?.user?.id,
      },

      // ShipToAddress
      customerShipToDetails: customerShipToDetails
        ? customerShipToDetails.map((item) => ({
          branchName: item?.branchName?.trim(),
          customerContactName: item?.customerContactName?.trim(),
          customerContactNumber: item?.customerContactNumber?.trim(),
          country: item?.country,
          state: item?.state,
          zipCode: item?.zipCode,
          city: item?.city?.trim(),
          address: item?.address?.trim(),
          billingCurrency: item?.billingCurrency,
          billingMode: item?.billingMode,
          createdBy: req.user.id,
        })) : [],

      customerCode: generatedCustomerCode,
      brands: Array.isArray(brands)
        ? brands
            .filter(b => b && b.brandId && b.brandName)
            .map(b => ({ brandId: b.brandId, brandName: b.brandName }))
        : [],

      zone: zone && zoneRefId ? {
        name: zone,
        refId: zoneRefId,
      } : undefined,

      salesPerson: salesPerson && salesPersonRefId ? {
        name: salesPerson,
        refId: salesPersonRefId,
      } : undefined,

      creditLimit,
      creditDays: creditDays && creditDaysRefId ? {
        name: creditDays,
        refId: creditDaysRefId,
      } : undefined,

      // System Internal details
      dcWithoutValue: false,
      designation: "Customer",
      createdBy: req.user.id,
      createdByName: req.user.employeeName,
      createdByDepartment: userDepartment,
      tenantId: req.user.tenantId,

      // Business Details
      yearOfEstablishment: yearOfEstablishment || undefined,
      proposedDiscount: proposedDiscount || undefined,
      currentlyDealtBrands: currentlyDealtBrands ? currentlyDealtBrands.trim() : undefined,
      minSalesValue: minSalesValue || undefined,
      finalDiscount: finalDiscount,

      // Sales Person Input Fields
      proprietorName: proprietorName,
      firmName: firmName.trim(),
      chequeDetails: Array.isArray(chequeDetails)
        ? chequeDetails.filter(c => (c.chequeNumber && c.chequeNumber.trim() !== "") || (c.chequeImage && c.chequeImage.trim() !== ""))
        : [],
      chequeRemark: chequeRemark || undefined,
      billingCycle: billingCycle,
      billingMode: billingMode,

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

    console.log("customerData  : ", customerData);

    const customer = await Customer.create(customerData);

    if (draftCustomerId) {
      try {
        const deletedDraft = await customerDraftSchema.findByIdAndDelete(draftCustomerId);
        if (deletedDraft) {
          console.log(`Draft customer ${draftCustomerId} deleted successfully`);
        } else {
          console.warn(`Draft customer ${draftCustomerId} not found for deletion`);
        }
      } catch (draftError) {
        console.error(`Error deleting draft customer ${draftCustomerId}:`, draftError);
      }
    }

    const customerObj = customer.toObject();
    delete customerObj.password;

    const message = isSalesDepartment ? "Customer registered successfully. Pending Finance approval." : "Customer registered and Pending sales head approval.";

    return sendSuccessResponse(res, 201, { customer: customerObj }, message);
  } catch (error) {
    console.error("Customer registration error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(res, 400, "MONGOOSE_VALIDATION_ERROR", messages.join(", "),);
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return sendErrorResponse(res, 409, "DUPLICATE_FIELD", `${field} already exists`);
    }
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Customer registration failed");
  }
};

export const customerForgotPassword = async (req, res) => {
  try {
    const { email, tenantId } = req.body;

    if (!email) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Please provide email address");
    }

    const query = {
      businessEmail: email.toLowerCase(),
      "status.isActive": true,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const customer = await Customer.findOne(query).select("+password");

    if (!customer) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'No active account found with that email address');
    }

    const { uidb36, token } = generateResetToken(customer._id, customer.password);

    const frontendUrl = process.env.FRONTEND_URL;
    const resetUrl = `${frontendUrl}/reset-password/confirm?uidb36=${uidb36}&token=${encodeURIComponent(token)}&type=customer`;

    const emailResult = await sendEmail({
      to: customer.businessEmail,
      subject: "DigiWholesale — Password Reset Request",
      html: ResetPasswordTemplate(customer.shopName || customer.ownerName, resetUrl, 30),
    });

    if (!emailResult.success) {
      return sendErrorResponse(res, 500, "EMAIL_FAILED", "Email could not be sent. Please try again.");
    }

    return sendSuccessResponse(res, 200, { message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Customer forgot password error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Email could not be sent");
  }
};

export const customerResetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { uidb36, token } = req.query;

    if (!uidb36 || !token) {
      return sendErrorResponse(res, 400, "INVALID_TOKEN", "Invalid reset link");
    }

    if (!password || !confirmPassword) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Please provide new password and confirm password");
    }

    if (password !== confirmPassword) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Passwords do not match");
    }

    if (password.length < 6) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Password must be at least 6 characters");
    }

    let userId;
    try {
      userId = decodeUidb36(uidb36);
    } catch {
      return sendErrorResponse(res, 400, "INVALID_TOKEN", "Invalid reset link");
    }

    const customer = await Customer.findById(userId).select("+password");

    if (!customer || !customer.status?.isActive) {
      return sendErrorResponse(res, 400, "INVALID_TOKEN", "Invalid reset link");
    }

    const { valid, expired } = verifyResetToken(uidb36, token, customer.password);

    if (expired) {
      return sendErrorResponse(res, 400, "TOKEN_EXPIRED", "Reset link has expired. Please request a new one.");
    }

    if (!valid) {
      return sendErrorResponse(res, 400, "INVALID_TOKEN", "Invalid reset link");
    }

    customer.password = password;
    customer.failedLoginAttempts = 0;
    customer.lockUntil = undefined;

    await customer.save({ validateBeforeSave: false });
    // await customer.save();

    return sendSuccessResponse(res, 200, { message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    console.error("Customer reset password error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Password could not be reset");
  }
};

export const updateCustomerProfile = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const updateData = req.body;

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    console.log("customer : ", customer);

    if (!customer) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
    }

    const updateFields = {};

    if (updateData.shopName) updateFields.shopName = updateData.shopName;
    if (updateData.ownerName) updateFields.ownerName = updateData.ownerName;
    if (updateData.mobileNo1) updateFields.mobileNo1 = updateData.mobileNo1;
    if (updateData.mobileNo2) updateFields.mobileNo2 = updateData.mobileNo2;
    if (updateData.creditUsed) updateFields.creditUsed = updateData.creditUsed;
    if (updateData.businessEmail)
      updateFields.businessEmail = updateData.businessEmail;

    if (updateData.yearOfEstablishment !== undefined) updateFields.yearOfEstablishment = updateData.yearOfEstablishment;
    if (updateData.proposedDiscount !== undefined) updateFields.proposedDiscount = updateData.proposedDiscount;
    if (updateData.currentlyDealtBrands !== undefined) updateFields.currentlyDealtBrands = updateData.currentlyDealtBrands?.trim();
    if (updateData.minSalesValue !== undefined) updateFields.minSalesValue = updateData.minSalesValue;
    if (updateData.finalDiscount !== undefined) updateFields.finalDiscount = updateData.finalDiscount;

    // Validate BusinessType
    if (updateData.BusinessType && updateData.BusinessTypeRefId) {
      const businessType = await BusinessType.findById(updateData.BusinessTypeRefId);
      if (!businessType) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `BusinessType with refId ${updateData.BusinessTypeRefId} does not exist`
        );
      }
      if (businessType.name !== updateData.BusinessType) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect BusinessType name for refId ${updateData.BusinessTypeRefId}. Expected: ${businessType.name}, Received: ${updateData.BusinessType}`
        );
      }
      updateFields.BusinessType = {
        name: updateData.BusinessType,
        refId: updateData.BusinessTypeRefId,
      };
    }

    // Validate zone
    if (updateData.zone && updateData.zoneRefId) {
      const location = await Location.findById(updateData.zoneRefId);
      if (!location) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `Zone with refId ${updateData.zoneRefId} does not exist`
        );
      }
      if (location.zone !== updateData.zone.toUpperCase()) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect zone name for refId ${updateData.zoneRefId}. Expected: ${location.zone}, Received: ${updateData.zone}`
        );
      }
      updateFields.zone = {
        name: updateData.zone.toUpperCase(),
        refId: updateData.zoneRefId,
      };
    }

    // Validate specificLab
    if (updateData.specificLab && updateData.specificLabRefId) {
      const specificLab = await SpecificLab.findById(updateData.specificLabRefId);
      if (!specificLab) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `SpecificLab with refId ${updateData.specificLabRefId} does not exist`
        );
      }
      if (specificLab.name !== updateData.specificLab) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect specificLab name for refId ${updateData.specificLabRefId}. Expected: ${specificLab.name}, Received: ${updateData.specificLab}`
        );
      }
      updateFields.specificLab = {
        name: updateData.specificLab,
        refId: updateData.specificLabRefId,
      };
    }

    // Validate plant
    if (updateData.plant && updateData.plantRefId) {
      const plant = await Plant.findById(updateData.plantRefId);
      if (!plant) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `Plant with refId ${updateData.plantRefId} does not exist`
        );
      }
      if (plant.name !== updateData.plant) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect plant name for refId ${updateData.plantRefId}. Expected: ${plant.name}, Received: ${updateData.plant}`
        );
      }
      updateFields.plant = {
        name: updateData.plant,
        refId: updateData.plantRefId,
      };
    }

    // Validate fittingCenter
    if (updateData.fittingCenter && updateData.fittingCenterRefId) {
      const fittingCenter = await FittingCenter.findById(updateData.fittingCenterRefId);
      if (!fittingCenter) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `FittingCenter with refId ${updateData.fittingCenterRefId} does not exist`
        );
      }
      if (fittingCenter.name !== updateData.fittingCenter) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect fittingCenter name for refId ${updateData.fittingCenterRefId}. Expected: ${fittingCenter.name}, Received: ${updateData.fittingCenter}`
        );
      }
      updateFields.fittingCenter = {
        name: updateData.fittingCenter,
        refId: updateData.fittingCenterRefId,
      };
    }

    // Validate creditDays
    if (updateData.creditDays && updateData.creditDaysRefId) {
      const creditDay = await CreditDay.findById(updateData.creditDaysRefId);
      if (!creditDay) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `CreditDays with refId ${updateData.creditDaysRefId} does not exist`
        );
      }
      if (creditDay.days.toString() !== updateData.creditDays.toString()) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect creditDays value for refId ${updateData.creditDaysRefId}. Expected: ${creditDay.days}, Received: ${updateData.creditDays}`
        );
      }
      updateFields.creditDays = {
        name: updateData.creditDays,
        refId: updateData.creditDaysRefId,
      };
    }

    // Validate courierName
    if (updateData.courierName && updateData.courierNameRefId) {
      const courierName = await CourierName.findById(updateData.courierNameRefId);
      if (!courierName) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `CourierName with refId ${updateData.courierNameRefId} does not exist`
        );
      }
      if (courierName.name !== updateData.courierName) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect courierName for refId ${updateData.courierNameRefId}. Expected: ${courierName.name}, Received: ${updateData.courierName}`
        );
      }
      updateFields.courierName = {
        name: updateData.courierName,
        refId: updateData.courierNameRefId,
      };
    }

    // Validate courierTime
    if (updateData.courierTime && updateData.courierTimeRefId) {
      const courierTime = await CourierTime.findById(updateData.courierTimeRefId);
      if (!courierTime) {
        return sendErrorResponse(
          res,
          404,
          "INVALID_REF_ID",
          `CourierTime with refId ${updateData.courierTimeRefId} does not exist`
        );
      }

      if (courierTime.time !== updateData.courierTime) {
        return sendErrorResponse(
          res,
          400,
          "NAME_MISMATCH",
          `Incorrect courierTime for refId ${updateData.courierTimeRefId}. Expected: ${courierTime.time}, Received: ${updateData.courierTime}`
        );
      }
      updateFields.courierTime = {
        name: updateData.courierTime,
        refId: updateData.courierTimeRefId,
      };
    }

    if (updateData.billToAddress) {
      if (typeof updateData.billToAddress !== 'object' || Array.isArray(updateData.billToAddress)) {
        return sendErrorResponse(
          res,
          400,
          "VALIDATION_ERROR",
          "Bill to address must be an object.",
        );
      }
      const addr = updateData.billToAddress;
      if (
        !addr.branchName ||
        !addr.customerContactName ||
        !addr.customerContactNumber ||
        !addr.country ||
        !addr.state ||
        !addr.city ||
        !addr.zipCode ||
        !addr.address ||
        !addr.billingCurrency ||
        !addr.billingMode
      ) {
        return sendErrorResponse(
          res,
          400,
          "VALIDATION_ERROR",
          "All bill to address fields are required (branchName, customerContactName, customerContactNumber, country, state, city, zipCode, address, billingCurrency, billingMode)",
        );
      }
      updateFields.billToAddress = {
        branchName: addr.branchName.trim(),
        customerContactName: addr.customerContactName.trim(),
        customerContactNumber: addr.customerContactNumber.trim(),
        country: addr.country,
        state: addr.state,
        zipCode: addr.zipCode,
        city: addr.city.trim(),
        address: addr.address.trim(),
        billingCurrency: addr.billingCurrency,
        billingMode: addr.billingMode,
        createdBy: req.user.id,
      };
    }

    if (updateData.businessEmail) {
      const existingCustomer = await Customer.findOne({
        businessEmail: updateData.businessEmail.toLowerCase(),
        tenantId: req.user.tenantId,
        _id: { $ne: customerId },
      });
      if (existingCustomer) {
        return sendErrorResponse(
          res,
          409,
          "EMAIL_EXISTS",
          "Another customer with this business email already exists",
        );
      }
      updateFields.businessEmail = updateData.businessEmail.toLowerCase().trim();
    }

    Object.assign(customer, updateFields);
    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, "Customer profile updated successfully");
  } catch (error) {
    console.error("Update customer profile error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", messages.join(", "));
    }
    if (error.code === 11000) {
      return sendErrorResponse(res, 409, "DUPLICATE_FIELD", "Email already exists");
    }
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Internal server error during profile update");
  }
};

export const resetCustomerCredit = async (req, res) => {
  try {
    const { customerId, creditUsed = 0 } = req.params;
    const userDepartment = req.user.Department?.name || req.user.Department;
    const userEmployeeType = req.user.EmployeeType;

    if (userEmployeeType !== 'SUPERADMIN' && userDepartment !== 'FINANCE') {
      return sendErrorResponse(
        res,
        403,
        'FORBIDDEN',
        'Only Finance department or SuperAdmin can reset customer credit'
      );
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid customer ID');
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    if (!customer) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Customer not found');
    }

    if (customer.isDeleted) {
      return sendErrorResponse(res, 400, 'CUSTOMER_DELETED', 'Cannot reset credit for deleted customer');
    }

    const oldCreditUsed = customer.creditUsed;

    customer.creditUsed = creditUsed;
    await customer.save();

    console.log(`Credit reset for customer ${customer.shopName} (${customerId}): ${oldCreditUsed} -> 0 by ${req.user.employeeName}`);

    return sendSuccessResponse(
      res,
      200,
      {
        customerId: customer._id,
        shopName: customer.shopName,
        previousCreditUsed: oldCreditUsed,
        currentCreditUsed: customer.creditUsed,
        creditLimit: customer.creditLimit,
        resetBy: req.user.employeeName,
        resetAt: new Date()
      },
      'Customer credit reset successfully'
    );
  } catch (error) {
    console.error('Reset customer credit error:', error);
    return sendErrorResponse(
      res,
      500,
      'INTERNAL_ERROR',
      'Failed to reset customer credit'
    );
  }
};

export const sendCustomerForCorrection = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { fieldsToCorrect, remark } = req.body;

    const userDepartment = req.user.Department?.name || req.user.Department;
    const userEmployeeType = req.user.EmployeeType;

    if (userEmployeeType !== 'SUPERADMIN' && userDepartment !== 'FINANCE') {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'Only Finance department or SuperAdmin can send customer data back for corrections');
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid customer ID format');
    }

    if (!fieldsToCorrect || !Array.isArray(fieldsToCorrect) || fieldsToCorrect.length === 0) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'fieldsToCorrect must be an array with at least one field name');
    }

    if (!remark || remark.trim() === '') {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'remark is required to explain what needs to be corrected');
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });

    if (!customer) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Customer not found');
    }

    if (customer.approvalWorkflow?.financeApprovalStatus === 'APPROVED') {
      return sendErrorResponse(res, 400, 'ALREADY_APPROVED', 'Customer is already approved. Cannot send back for corrections.');
    }

    if (customer.approvalWorkflow?.financeApprovalStatus !== 'PENDING') {
      return sendErrorResponse(res, 400, 'INVALID_STATUS', 'Customer must be in PENDING status to send back for corrections');
    }

    const allowedFields = [
      'finalDiscount',
      'shopName',
      'ownerName',
      'BusinessType',
      'BusinessTypeRefId',
      'orderMode',
      'mobileNo1',
      'mobileNo2',
      'businessEmail',
      'billToAddress',
      'IsGSTRegistered',
      'GSTNumber',
      'gstType',
      'gstTypeRefId',
      'GSTCertificateImg',
      'PANCard',
      'AadharCard',
      'PANCardImg',
      'AadharCardImg',
      'yearOfEstablishment',
      'proposedDiscount',
      'currentlyDealtBrands',
      'minSalesValue',
      'zone',
      'zoneRefId',
      'specificLab',
      'specificLabRefId',
      'plant',
      'plantRefId',
      'fittingCenter',
      'fittingCenterRefId',
      'creditDays',
      'creditDaysRefId',
      'creditLimit',
      'courierName',
      'courierNameRefId',
      'courierTime',
      'courierTimeRefId',
      'brandCategories',
      'salesPerson',
      'salesPersonRefId'
    ];

    const invalidFields = fieldsToCorrect.filter(field => {
      if (allowedFields.includes(field)) return false;
      const billToAddressFieldPattern = /^billToAddress(\[\d+\])?\.(branchName|customerContactName|customerContactNumber|city|state|zipCode|country|address|billingCurrency|billingMode)$/;
      if (billToAddressFieldPattern.test(field)) return false;
      return true;
    });

    if (invalidFields.length > 0) {
      return sendErrorResponse(res, 400, 'INVALID_FIELDS', `Invalid field names: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}. For bill to address corrections use format "billToAddress.fieldName" (e.g., "billToAddress.branchName", "billToAddress.billingCurrency")`);
    }

    console.log("Anish : ", req.user);

    customer.approvalWorkflow.financeApprovalStatus = 'MODIFICATION_REQUIRED';
    customer.correctionRequest = {
      fieldsToCorrect: fieldsToCorrect,
      remark: remark.trim(),
      requestedBy: req.user.id,
      requestedEmployeeName: req.user.employeeName,
      requestedAt: new Date(),
      correctionNeededBy: 'SALES'
    };

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, {
      customer: customerObj,
      correctionRequest: {
        fieldsToCorrect: fieldsToCorrect,
        remark: remark.trim(),
        requestedBy: req.user.employeeName || req.user.email,
        requestedAt: customer.correctionRequest.requestedAt
      }
    }, 'Customer sent back to sales for corrections successfully');

  } catch (error) {
    console.error('Send customer for correction error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to send customer for corrections');
  }
};

export const resubmitCorrectedCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const updateData = req.body;

    const userDepartment = req.user?.Department?.name || req.user?.Department;
    const userEmployeeType = req.user?.EmployeeType;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid customer ID format');
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });

    if (!customer) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Customer not found');
    }

    if (customer.approvalWorkflow?.financeApprovalStatus !== 'MODIFICATION_REQUIRED') {
      return sendErrorResponse(
        res,
        400,
        'INVALID_STATUS',
        'Customer is not in MODIFICATION_REQUIRED status'
      );
    }

    if (userDepartment !== 'SALES' && userEmployeeType !== 'SUPERADMIN') {
      if (customer.createdBy.toString() !== req.user.id.toString()) {
        return sendErrorResponse(
          res,
          403,
          'FORBIDDEN',
          'You can only resubmit customers you created'
        );
      }
    }

    const fieldsToCorrect = customer.correctionRequest?.fieldsToCorrect || [];

    if (fieldsToCorrect.length === 0) {
      return sendErrorResponse(
        res,
        400,
        'NO_CORRECTION_REQUEST',
        'No correction request found for this customer'
      );
    }
    const hasRelevantUpdate = fieldsToCorrect.some(field => {
      if (field === 'billToAddress') {
        return updateData.billToAddress !== undefined;
      }
      if (field.startsWith('billToAddress[')) {
        return updateData.billToAddress !== undefined;
      }
      return updateData[field] !== undefined;
    });

    if (!hasRelevantUpdate) {
      return sendErrorResponse(
        res,
        400,
        'MISSING_CORRECTIONS',
        `Please update at least one of the requested fields: ${fieldsToCorrect.join(', ')}`
      );
    }

    const updateFields = {};

    if (updateData.shopName) updateFields.shopName = updateData.shopName.trim();
    if (updateData.ownerName) updateFields.ownerName = updateData.ownerName.trim();
    if (updateData.mobileNo1) updateFields.mobileNo1 = updateData.mobileNo1;
    if (updateData.mobileNo2) updateFields.mobileNo2 = updateData.mobileNo2;
    if (updateData.businessEmail) updateFields.businessEmail = updateData.businessEmail.toLowerCase().trim();
    if (updateData.IsGSTRegistered !== undefined) updateFields.IsGSTRegistered = updateData.IsGSTRegistered;
    if (updateData.GSTNumber) updateFields.GSTNumber = updateData.GSTNumber;
    if (updateData.GSTCertificateImg) updateFields.GSTCertificateImg = updateData.GSTCertificateImg;
    if (updateData.PANCard) updateFields.PANCard = updateData.PANCard;
    if (updateData.AadharCard) updateFields.AadharCard = updateData.AadharCard;
    if (updateData.PANCardImg) updateFields.PANCardImg = updateData.PANCardImg;
    if (updateData.AadharCardImg) updateFields.AadharCardImg = updateData.AadharCardImg;
    if (updateData.finalDiscount) updateFields.finalDiscount = updateData.finalDiscount;
    if (updateData.yearOfEstablishment !== undefined) updateFields.yearOfEstablishment = updateData.yearOfEstablishment;
    if (updateData.proposedDiscount !== undefined) updateFields.proposedDiscount = updateData.proposedDiscount;
    if (updateData.currentlyDealtBrands !== undefined) updateFields.currentlyDealtBrands = updateData.currentlyDealtBrands?.trim();
    if (updateData.minSalesValue !== undefined) updateFields.minSalesValue = updateData.minSalesValue;

    if (updateData.BusinessType && updateData.BusinessTypeRefId) {
      const businessType = await BusinessType.findById(updateData.BusinessTypeRefId);
      if (!businessType) {
        return sendErrorResponse(res, 404, 'INVALID_REF_ID', `BusinessType with refId ${updateData.BusinessTypeRefId} does not exist`);
      }
      if (businessType.name !== updateData.BusinessType) {
        return sendErrorResponse(res, 400, 'NAME_MISMATCH', `Incorrect BusinessType name for refId ${updateData.BusinessTypeRefId}`);
      }
      updateFields.BusinessType = {
        name: updateData.BusinessType,
        refId: updateData.BusinessTypeRefId,
      };
    }

    // Validate gstType
    if (updateData.gstType && updateData.gstTypeRefId) {
      const gstTypeDoc = await GSTType.findById(updateData.gstTypeRefId);
      if (!gstTypeDoc) {
        return sendErrorResponse(
          res,
          404,
          'INVALID_REF_ID',
          `GSTType with refId ${updateData.gstTypeRefId} does not exist`
        );
      }
      if (gstTypeDoc.name !== updateData.gstType) {
        return sendErrorResponse(
          res,
          400,
          'NAME_MISMATCH',
          `Incorrect gstType name for refId ${updateData.gstTypeRefId}`
        );
      }
      updateFields.gstType = {
        name: updateData.gstType,
        refId: updateData.gstTypeRefId,
      };
    }

    // Handle bill to address updates
    if (updateData.billToAddress) {
      if (typeof updateData.billToAddress !== 'object' || Array.isArray(updateData.billToAddress)) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Bill to address must be an object..');
      }

      const addr = updateData.billToAddress;
      const requiredAddressFields = [
        'branchName',
        'customerContactName',
        'customerContactNumber',
        'city',
        'state',
        'zipCode',
        'country',
        'address',
        'billingCurrency',
        'billingMode'
      ];

      const missingFields = requiredAddressFields.filter(field => !addr[field]);
      if (missingFields.length > 0) {
        return sendErrorResponse(
          res,
          400,
          'VALIDATION_ERROR',
          `BillToAddress missing required fields: ${missingFields.join(', ')}`
        );
      }

      updateFields.billToAddress = {
        branchName: addr.branchName.trim(),
        customerContactName: addr.customerContactName.trim(),
        customerContactNumber: addr.customerContactNumber.trim(),
        country: addr.country,
        state: addr.state,
        zipCode: addr.zipCode,
        city: addr.city.trim(),
        address: addr.address.trim(),
        billingCurrency: addr.billingCurrency,
        billingMode: addr.billingMode,
        createdBy: req.user.id,
      };
    }

    // Handle email update
    if (updateData.businessEmail) {
      const existingCustomer = await Customer.findOne({
        businessEmail: updateData.businessEmail.toLowerCase(),
        tenantId: req.user.tenantId,
        _id: { $ne: customerId },
      });
      if (existingCustomer) {
        return sendErrorResponse(
          res,
          409,
          'EMAIL_EXISTS',
          'Another customer with this business email already exists'
        );
      }
      updateFields.businessEmail = updateData.businessEmail.toLowerCase().trim();
    }

    Object.assign(customer, updateFields);
    customer.approvalWorkflow.financeApprovalStatus = 'PENDING';
    customer.correctionRequest = undefined;
    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, 'Customer corrections submitted successfully.');
  } catch (error) {
    console.error('Resubmit corrected customer error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        messages.join(', ')
      );
    }

    if (error.code === 11000) {
      return sendErrorResponse(
        res,
        409,
        'DUPLICATE_FIELD',
        'Email already exists'
      );
    }

    return sendErrorResponse(
      res,
      500,
      'INTERNAL_ERROR',
      'Failed to resubmit customer corrections'
    );
  }
};

export const updateCustomerShipToDetails = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { shipToDetails } = req.body;

    const userEmployeeType = req.user?.EmployeeType;
    const userDepartment = req.user?.Department?.name || req.user?.Department;

    if (userEmployeeType !== "SUPERADMIN" && userDepartment !== "FINANCE") {
      return sendErrorResponse(res, 403, "FORBIDDEN", "Only Finance department and SuperAdmin can update ship-to details");
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, "INVALID_ID", "Invalid customer ID format");
    }

    if (!shipToDetails || !Array.isArray(shipToDetails) || shipToDetails.length === 0) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "shipToDetails must be a non-empty array");
    }

    for (let i = 0; i < shipToDetails.length; i++) {
      const address = shipToDetails[i];
      const requiredFields = ['branchName', 'customerContactName', 'customerContactNumber', 'country', 'state', 'city', 'billingCurrency', 'billingMode'];

      for (const field of requiredFields) {
        if (!address[field] || address[field].toString().trim() === '') {
          return sendErrorResponse(res, 400, "VALIDATION_ERROR", `shipToDetails[${i}].${field} is required`);
        }
      }

      if (!/^[0-9]{10}$/.test(address.customerContactNumber)) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", `shipToDetails[${i}].customerContactNumber must be 10 digits`);
      }

      if (address._id && !mongoose.Types.ObjectId.isValid(address._id)) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", `shipToDetails[${i}]._id is not a valid ID`);
      }
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    if (!customer) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
    }

    if (customer.approvalWorkflow?.salesHeadApprovalStatus !== 'APPROVED') {
      return sendErrorResponse(res, 400, "INVALID_STATUS", "Customer must be approved by Sales Head before updating ship-to details");
    }

    for (const address of shipToDetails) {
      const mapped = {
        branchName: address.branchName.trim(),
        customerContactName: address.customerContactName.trim(),
        customerContactNumber: address.customerContactNumber.trim(),
        country: address.country.trim(),
        state: address.state.trim(),
        city: address.city.trim(),
        zipCode: address.zipCode ? address.zipCode.trim() : undefined,
        address: address.address ? address.address.trim() : undefined,
        billingCurrency: address.billingCurrency,
        billingMode: address.billingMode,
        updatedBy: req.user.id,
      };

      if (address._id) {
        const existing = customer.customerShipToDetails.id(address._id);
        if (!existing) {
          return sendErrorResponse(res, 404, "NOT_FOUND", `shipToDetails entry with _id ${address._id} not found`);
        }
        Object.assign(existing, mapped);
      } else {
        customer.customerShipToDetails.push({ ...mapped, createdBy: req.user.id });
      }
    }

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, "Ship-to details updated successfully");

  } catch (error) {
    console.error("Update customer ship-to details error:", error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to update ship-to details");
  }
}
