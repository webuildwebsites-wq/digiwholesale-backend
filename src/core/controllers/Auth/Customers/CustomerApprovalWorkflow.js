import { sendErrorResponse, sendSuccessResponse } from "../../../../Utils/response/responseHandler.js";
import { sendEmail } from "../../../config/Email/emailService.js";
import Customer from "../../../../models/Auth/Customer.js";
import mongoose from "mongoose";
import CredentialsTemplate from "../../../../Utils/Mail/CredentialsTemplate.js";
import { generateRandomPassword } from "../../../../Utils/Auth/customerAuthUtils.js";

export const financeApproveCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { action, remark, fieldsToCorrect, finnalPayload } = req.body;
    const userId = req.user.id;
    const userDepartment = req.user?.Department?.name || req.user?.Department;

    if (userDepartment !== "FINANCE" && req.user?.EmployeeType !== "SUPERADMIN") {
      return sendErrorResponse(res, 403, "FORBIDDEN", "Only Finance team can approve customers");
    }

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, "INVALID_ID", "Invalid customer ID");
    }

    if (!action || !["APPROVE", "REQUEST_MODIFICATION"].includes(action)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "action must be either 'APPROVE' or 'REQUEST_MODIFICATION'");
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    if (!customer) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
    }

    if (customer.approvalWorkflow.financeApprovalStatus !== "PENDING") {
      return sendErrorResponse(res, 400, "INVALID_STATUS", "Customer is not pending finance approval");
    }

    if (action === "APPROVE") {
      if (finnalPayload && typeof finnalPayload === 'object') {
        const allowedFields = ['finalDiscount', 'creditLimit', 'creditDays', 'proposedDiscount', 'yearOfEstablishment'];
        for (const field of allowedFields) {
          if (finnalPayload[field] !== undefined && finnalPayload[field] !== null) {
            customer[field] = finnalPayload[field];
          }
        }
      }

      customer.approvalWorkflow.financeApprovalStatus = "APPROVED";
      customer.approvalWorkflow.financeApprovedBy = userId;
      customer.approvalWorkflow.financeApprovedAt = new Date();
      customer.approvalWorkflow.financeRemark = remark || "";
      customer.approvalWorkflow.salesHeadApprovalStatus = "PENDING";
    } else if (action === "REQUEST_MODIFICATION") {
      if (!fieldsToCorrect || !Array.isArray(fieldsToCorrect) || fieldsToCorrect.length === 0) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "fieldsToCorrect array is required when requesting modifications");
      }

      customer.approvalWorkflow.financeApprovalStatus = "MODIFICATION_REQUIRED";
      customer.correctionRequest = {
        fieldsToCorrect,
        remark: remark || "",
        requestedEmployeeName: req.user.employeeName,
        requestedBy: userId,
        requestedAt: new Date(),
        correctionNeededBy: 'SALES'
      };
    }

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, `Customer ${action === "APPROVE" ? "approved" : "sent for modification"} by Finance team`);
  } catch (error) {
    console.error("Finance approval error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Finance approval failed");
  }
};

export const salesHeadApproveCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { action, remark, blacklistReason, fieldsToCorrect, finnalPayload } = req.body;
    const userId = req.user.id;

    const isSalesHead = Array.isArray(req.user?.subRoles) && req.user.subRoles.some(r => r.code === 'SALES_HEAD');
    const isAdminOrAbove = ["SUPERADMIN", "ADMIN"].includes(req.user?.EmployeeType);

    if (!isAdminOrAbove && !isSalesHead) {
      return sendErrorResponse(res, 403, "FORBIDDEN", "Only Sales Head or Admin can approve customers");
    }

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, "INVALID_ID", "Invalid customer ID");
    }

    if (!action || !["APPROVE", "REJECT", "REQUEST_MODIFICATION"].includes(action)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "action must be 'APPROVE', 'REJECT', or 'REQUEST_MODIFICATION'");
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    if (!customer) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
    }

    if (customer.approvalWorkflow.financeApprovalStatus !== "APPROVED") {
      return sendErrorResponse(res, 400, "INVALID_STATUS", "Customer must be approved by Finance before Sales Head approval");
    }

    if (customer.approvalWorkflow.salesHeadApprovalStatus === "APPROVED") {
      return sendErrorResponse(res, 400, "ALREADY_APPROVED", "Sales Head has already approved this customer");
    }

    if (action === "APPROVE") {
      if (finnalPayload && typeof finnalPayload === 'object') {
        const allowedFields = ['finalDiscount', 'creditLimit', 'creditDays', 'proposedDiscount', 'yearOfEstablishment'];
        for (const field of allowedFields) {
          if (finnalPayload[field] !== undefined && finnalPayload[field] !== null) {
            customer[field] = finnalPayload[field];
          }
        }
      }
      
      customer.approvalWorkflow.salesHeadApprovalStatus = "APPROVED";
      customer.approvalWorkflow.salesHeadApprovedBy = userId;
      customer.approvalWorkflow.salesHeadApprovedAt = new Date();
      customer.approvalWorkflow.salesHeadRemark = remark || "";
      customer.status.isActive = true;

      const plainPassword = generateRandomPassword();
      customer.password = plainPassword;

      await customer.save();

      sendEmail({
        to: customer.businessEmail,
        subject: "Your Account Approved - Welcome to DigiWholesale",
        html: CredentialsTemplate(
          customer.ownerName,
          customer.businessEmail,
          plainPassword
        ),
      }).catch((err) => console.error("Background email error:", err));

      const customerObj = customer.toObject();
      delete customerObj.password;
      return sendSuccessResponse(res, 200, { customer: customerObj }, "Customer approved by Sales Head");

    } else if (action === "REJECT") {
      if (!blacklistReason || blacklistReason.trim() === "") {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "blacklistReason is required when blacklisting a customer");
      }
      customer.isBlacklisted = true;
      customer.blacklistReason = blacklistReason;
      customer.approvalWorkflow.salesHeadApprovalStatus = "REJECTED";
      customer.approvalWorkflow.salesHeadApprovedBy = userId;
      customer.approvalWorkflow.salesHeadApprovedAt = new Date();
      customer.status.isActive = false;
    } else if (action === "REQUEST_MODIFICATION") {
      if (!fieldsToCorrect || !Array.isArray(fieldsToCorrect) || fieldsToCorrect.length === 0) {
        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "fieldsToCorrect array is required when requesting modifications");
      }
      customer.approvalWorkflow.financeApprovalStatus = "MODIFICATION_REQUIRED";
      customer.correctionRequest = {
        fieldsToCorrect,
        remark: remark || "",
        requestedEmployeeName: req.user.employeeName,
        requestedBy: userId,
        requestedAt: new Date(),
        correctionNeededBy: 'FINANCE'
      };
    }

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, `Customer ${action.toLowerCase()} by Sales Head`);
  } catch (error) {
    console.error("Sales Head approval error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Sales Head approval failed");
  }
};

export const acceptTermsAndConditions = async (req, res) => {
  try {
    const customerId = req.user.id;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
    }

    if (customer.approvalWorkflow.salesHeadApprovalStatus !== "APPROVED") {
      return sendErrorResponse(res, 400, "INVALID_STATUS", "Customer must be approved by Sales Head before accepting terms");
    }

    if (customer.isBlacklisted) {
      return sendErrorResponse(res, 403, "BLACKLISTED", "This customer is blacklisted and cannot proceed");
    }

    if (customer.termsAndConditionsAccepted) {
      return sendErrorResponse(res, 400, "ALREADY_ACCEPTED", "Terms and conditions have already been accepted");
    }

    customer.termsAndConditionsAccepted = true;
    customer.termsAcceptedAt = new Date();
    customer.status.isActive = true;

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, "Terms and conditions accepted. Customer is now finalized.");
  } catch (error) {
    console.error("Terms acceptance error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Terms acceptance failed");
  }
};

export const financeResubmitToSalesHead = async (req, res) => {
  try {
    const { customerId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;
    const userDepartment = req.user?.Department?.name || req.user?.Department;
    const userEmployeeType = req.user?.EmployeeType;

    if (userDepartment !== "FINANCE" && userEmployeeType !== "SUPERADMIN") {
      return sendErrorResponse(res, 403, "FORBIDDEN", "Only Finance team can resubmit corrections to Sales Head");
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, "INVALID_ID", "Invalid customer ID");
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    if (!customer) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
    }

    if (customer.approvalWorkflow.financeApprovalStatus !== "MODIFICATION_REQUIRED") {
      return sendErrorResponse(res, 400, "INVALID_STATUS", "Customer is not in MODIFICATION_REQUIRED status");
    }

    if (customer.correctionRequest?.correctionNeededBy !== "FINANCE") {
      return sendErrorResponse(res, 400, "INVALID_STATUS", "This correction is not assigned to Finance department");
    }

    const fieldsToCorrect = customer.correctionRequest?.fieldsToCorrect || [];

    if (fieldsToCorrect.length > 0) {
      const hasRelevantUpdate = fieldsToCorrect.some(field => updateData[field] !== undefined);
      if (!hasRelevantUpdate) {
        return sendErrorResponse(res, 400, "MISSING_CORRECTIONS", `Please update at least one of the requested fields: ${fieldsToCorrect.join(", ")}`);
      }
    }

    // Apply only the allowed updatable fields for Finance
    const allowedFinanceFields = [
      "finalDiscount", "creditLimit", "creditDays", "creditDaysRefId",
      "zone", "zoneRefId", "specificLab", "specificLabRefId",
      "plant", "plantRefId", "fittingCenter", "fittingCenterRefId",
      "courierName", "courierNameRefId", "courierTime", "courierTimeRefId",
      "brandCategories", "salesPerson", "salesPersonRefId",
      "billingCycle", "billingMode", "proposedDiscount", "minSalesValue"
    ];

    for (const field of allowedFinanceFields) {
      if (updateData[field] !== undefined) {
        customer[field] = updateData[field];
      }
    }

    // Reset workflow: Finance re-approves and sends back to Sales Head
    customer.approvalWorkflow.financeApprovalStatus = "APPROVED";
    customer.approvalWorkflow.financeApprovedBy = userId;
    customer.approvalWorkflow.financeApprovedAt = new Date();
    customer.approvalWorkflow.salesHeadApprovalStatus = "PENDING";
    customer.correctionRequest = undefined;

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return sendSuccessResponse(res, 200, { customer: customerObj }, "Corrections submitted. Customer sent back to Sales Head for approval.");
  } catch (error) {
    console.error("Finance resubmit error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message);
      return sendErrorResponse(res, 400, "MONGOOSE_VALIDATION_ERROR", messages.join(", "));
    }
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Finance resubmit failed");
  }
};

export const getPendingCustomersByStage = async (req, res) => {
  try {
    const { stage } = req.query;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    let query = {};

    if (stage === "finance") {
      query = { "approvalWorkflow.financeApprovalStatus": "PENDING" };
    } else if (stage === "salesHead") {
      query = { "approvalWorkflow.financeApprovalStatus": "APPROVED", "approvalWorkflow.salesHeadApprovalStatus": "PENDING" };
    } else if (stage === "salesCorrection") {
      query = { "approvalWorkflow.financeApprovalStatus": "MODIFICATION_REQUIRED", "correctionRequest.correctionNeededBy": "SALES" };
    } else if (stage === "financeCorrection") {
      query = { "approvalWorkflow.financeApprovalStatus": "MODIFICATION_REQUIRED", "correctionRequest.correctionNeededBy": "FINANCE" };
    } else {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "stage must be one of: finance, salesHead, salesCorrection, financeCorrection");
    }

    query.tenantId = req.user.tenantId;

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

    return sendSuccessResponse(res, 200, { customers, pagination }, `Retrieved ${customers.length} customers pending at ${stage} stage`);
  } catch (error) {
    console.error("Get pending customers error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve pending customers");
  }
};
