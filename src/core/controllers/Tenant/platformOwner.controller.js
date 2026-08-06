import Tenant from "../../../models/Tenant/Tenant.model.js";
import Employee from "../../../models/Auth/Employee.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { generateEmployeeCode } from "../../../Utils/Auth/customerAuthUtils.js";
import dotenv from "dotenv";
dotenv.config();

const generateTenantId = (storeName) => {
    const slug = storeName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)
        .padEnd(3, "X");
    const rand = Math.random().toString(36).toUpperCase().slice(2, 7);
    return `TEN-${slug}-${rand}`;
};

export const registerTenant = async (req, res) => {
    try {
        const {
            storeName, address, storeTiming, commissionPercentage, expiryDate,
            emailApi, showAds, hasGST, hasAI,
            ownerName, email, mobile, password,
            rsPerPoint, pointValue, referPoints,
            storeLogo, gstCertificate, panCard, aadhaarCard,
            planType, selectedPages, autoPermissions,
            utilityProvider, promotionProvider,
        } = req.body;

        if (!storeName || !address || !storeTiming || commissionPercentage === undefined || !expiryDate) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "storeName, address, storeTiming, commissionPercentage, expiryDate are required");
        }
        if (!ownerName || !email || !mobile || !password) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "ownerName, email, mobile, password are required");
        }

        const commission = Number(commissionPercentage);
        if (isNaN(commission) || commission < 0 || commission > 100) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "commissionPercentage must be between 0 and 100");
        }

        const expiry = new Date(expiryDate);
        if (isNaN(expiry.valueOf()) || expiry <= new Date()) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "expiryDate must be a valid future date");
        }

        const resolvedPlanType = planType || "PRO";
        if (!["PRO", "PREMIUM", "CUSTOM"].includes(resolvedPlanType)) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "planType must be PRO, PREMIUM, or CUSTOM");
        }

        if (resolvedPlanType === "CUSTOM" && (!Array.isArray(selectedPages) || selectedPages.length === 0)) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "selectedPages array is required for CUSTOM planType");
        }

        if (!gstCertificate && !panCard && !aadhaarCard) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "At least one document URL (gstCertificate, panCard, or aadhaarCard) must be provided");
        }

        const existingTenant = await Tenant.findOne({ "owner.email": email.toLowerCase() });
        if (existingTenant) {
            return sendErrorResponse(res, 409, "TENANT_EXISTS", "A tenant with this email already exists");
        }

        const existingEmployee = await Employee.findOne({ email: email.toLowerCase() });
        if (existingEmployee) {
            return sendErrorResponse(res, 409, "EMPLOYEE_EXISTS", "An employee with this email already exists");
        }

        let tenantId = generateTenantId(storeName);
        while (await Tenant.findOne({ tenantId })) {
            tenantId = generateTenantId(storeName);
        }

        let finalPages       = [];
        let finalPermissions = [];

        if (resolvedPlanType === "PRO") {
            finalPages       = [...Tenant.ALL_PAGES];
            finalPermissions = [...Tenant.ALL_PERMISSIONS];
        } else if (resolvedPlanType === "PREMIUM") {
            finalPages       = [...Tenant.PREMIUM_PAGES];
            finalPermissions = [];
        } else {
            finalPages       = selectedPages;
            finalPermissions = Array.isArray(autoPermissions) ? autoPermissions : [];
        }

        const tenant = await Tenant.create({
            tenantId,
            storeInformation: {
                storeName:            storeName.trim(),
                address:              address.trim(),
                storeTiming:          storeTiming.trim(),
                commissionPercentage: commission,
                expiryDate:           expiry,
                emailApi:             emailApi || null,
                showAds:              !!showAds,
                hasGST:               !!hasGST,
                hasAI:                !!hasAI,
                storeLogo:            storeLogo || null,
            },
            owner: {
                ownerName: ownerName.trim(),
                email:     email.toLowerCase().trim(),
                mobile:    mobile.trim(),
            },
            loyalty: {
                rsPerPoint:  Number(rsPerPoint)  || 0,
                pointValue:  Number(pointValue)  || 0,
                referPoints: Number(referPoints) || 0,
            },
            documents: {
                gstCertificate: gstCertificate || null,
                panCard:        panCard        || null,
                aadhaarCard:    aadhaarCard    || null,
            },
            subscription: {
                planType:        resolvedPlanType,
                expiresAt:       expiry,
                isActive:        true,
                selectedPages:   finalPages,
                autoPermissions: finalPermissions,
            },
            whatsappConfig: {
                utilityProvider:   utilityProvider   || "META",
                promotionProvider: promotionProvider || "META",
            },
            status:    "ACTIVE",
            createdBy: req.user._id,
        });

        let employeeCode = generateEmployeeCode(ownerName);
        while (await Employee.findOne({ employeeCode })) {
            employeeCode = generateEmployeeCode(ownerName);
        }

        const superAdmin = new Employee({
            employeeName:      ownerName.trim(),
            username:          email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 15) || `admin${Date.now()}`,
            email:             email.toLowerCase().trim(),
            password,
            phone:             mobile.trim(),
            address:           address.trim(),
            country:           "India",
            EmployeeType:      "SUPERADMIN",
            employeeCode,
            tenantId,
            isActive:          true,
            pageAccess:        finalPages,
            accessPermissions: finalPermissions,
        });
        await superAdmin.save();

        const tenantObj     = tenant.toObject();
        const superAdminObj = superAdmin.toObject();
        delete superAdminObj.password;

        return sendSuccessResponse(res, 201, {
            tenant:     tenantObj,
            superAdmin: superAdminObj,
        }, `Tenant "${storeName}" registered successfully with tenantId: ${tenantId}`);

    } catch (err) {
        console.error("registerTenant error:", err);
        return sendErrorResponse(res, 500, "REGISTER_TENANT_ERROR", err.message);
    }
};

export const getAllTenants = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;
        const { status, search } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (search?.trim()) {
            const r = { $regex: search.trim(), $options: "i" };
            filter.$or = [
                { "storeInformation.storeName": r },
                { tenantId:                     r },
                { "owner.email":                r },
                { "owner.mobile":               r },
            ];
        }

        const [tenants, total] = await Promise.all([
            Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Tenant.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            tenants,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Tenants retrieved successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "GET_TENANTS_ERROR", err.message);
    }
};

export const getTenantById = async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id).lean();
        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");
        return sendSuccessResponse(res, 200, { tenant });
    } catch (err) {
        return sendErrorResponse(res, 500, "GET_TENANT_ERROR", err.message);
    }
};

export const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = [
            "storeInformation", "owner", "loyalty",
            "documents", "subscription", "whatsappConfig",
        ];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        const tenant = await Tenant.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");

        return sendSuccessResponse(res, 200, { tenant }, "Tenant updated successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "UPDATE_TENANT_ERROR", err.message);
    }
};

export const suspendTenant = async (req, res) => {
    try {
        const { reason } = req.body;
        const tenant = await Tenant.findByIdAndUpdate(
            req.params.id,
            { status: "SUSPENDED", suspensionReason: reason || "", "subscription.isActive": false },
            { new: true }
        );
        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");
        return sendSuccessResponse(res, 200, { tenant }, "Tenant suspended successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "SUSPEND_TENANT_ERROR", err.message);
    }
};

export const activateTenant = async (req, res) => {
    try {
        const tenant = await Tenant.findByIdAndUpdate(
            req.params.id,
            { status: "ACTIVE", suspensionReason: null, "subscription.isActive": true },
            { new: true }
        );
        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");
        return sendSuccessResponse(res, 200, { tenant }, "Tenant activated successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "ACTIVATE_TENANT_ERROR", err.message);
    }
};

export const deleteTenant = async (req, res) => {
    try {
        const tenant = await Tenant.findByIdAndDelete(req.params.id);
        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");

        await Employee.deleteMany({ tenantId: tenant.tenantId });

        return sendSuccessResponse(res, 200, null, `Tenant "${tenant.storeInformation?.storeName || tenant.businessName || tenant.tenantId}" and all associated employees deleted successfully`);
    } catch (err) {
        return sendErrorResponse(res, 500, "DELETE_TENANT_ERROR", err.message);
    }
};
