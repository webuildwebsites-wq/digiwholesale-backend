import Tenant from "../../../models/Tenant/Tenant.model.js";
import Employee from "../../../models/Auth/Employee.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { generateEmployeeCode } from "../../../Utils/Auth/customerAuthUtils.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Normalizes tenant object so demoMode and demoExpiry are ALWAYS explicitly present at both root and featureFlags level.
 */
export const formatTenantResponse = (tenant) => {
    if (!tenant) return tenant;
    const t = typeof tenant.toObject === "function" ? tenant.toObject() : { ...tenant };
    const isDemoOn = Boolean(t.demoMode || t.featureFlags?.demoMode);
    const demoExp = t.demoExpiry || t.featureFlags?.demoExpiry || null;
    return {
        ...t,
        demoMode: isDemoOn,
        demoExpiry: demoExp,
        featureFlags: {
            ...(t.featureFlags || {}),
            ecomFramesSunglasses: Boolean(t.featureFlags?.ecomFramesSunglasses),
            demoMode: isDemoOn,
            demoExpiry: demoExp,
        }
    };
};

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
            demoMode:   Boolean(req.body.demoMode || req.body.featureFlags?.demoMode),
            demoExpiry: (req.body.demoExpiry || req.body.featureFlags?.demoExpiry) ? new Date(req.body.demoExpiry || req.body.featureFlags?.demoExpiry) : null,
            featureFlags: {
                ecomFramesSunglasses: Boolean(req.body.ecomFramesSunglasses || req.body.featureFlags?.ecomFramesSunglasses),
                demoMode:             Boolean(req.body.demoMode || req.body.featureFlags?.demoMode),
                demoExpiry:           (req.body.demoExpiry || req.body.featureFlags?.demoExpiry) ? new Date(req.body.demoExpiry || req.body.featureFlags?.demoExpiry) : null,
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

        const formattedTenants = tenants.map(formatTenantResponse);
        return sendSuccessResponse(res, 200, {
            tenants: formattedTenants,
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
        const tenantDoc = await Tenant.findById(req.params.id).lean();
        if (!tenantDoc) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");
        const tenant = formatTenantResponse(tenantDoc);
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
            "documents", "subscription", "whatsappConfig", "featureFlags",
            "demoMode", "demoExpiry",
        ];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        const existingTenant = await Tenant.findById(id).lean();
        if (!existingTenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");

        const demoModeVal = req.body.demoMode !== undefined ? req.body.demoMode : req.body.featureFlags?.demoMode;
        const demoExpiryVal = req.body.demoExpiry !== undefined ? req.body.demoExpiry : req.body.featureFlags?.demoExpiry;

        if (demoModeVal !== undefined || demoExpiryVal !== undefined) {
            const currentFlags = existingTenant.featureFlags || {};
            const newDemoMode = demoModeVal !== undefined ? Boolean(demoModeVal) : Boolean(existingTenant.demoMode || currentFlags.demoMode);
            const newDemoExpiry = demoExpiryVal !== undefined ? (demoExpiryVal ? new Date(demoExpiryVal) : null) : (existingTenant.demoExpiry || currentFlags.demoExpiry);

            updates.demoMode = newDemoMode;
            updates.demoExpiry = newDemoExpiry;
            updates.featureFlags = {
                ecomFramesSunglasses: Boolean(currentFlags.ecomFramesSunglasses),
                demoMode: newDemoMode,
                demoExpiry: newDemoExpiry,
            };
        }

        const tenantDoc = await Tenant.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
        const tenant = formatTenantResponse(tenantDoc);

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

// ─── WHOLESALER SETTINGS (Platform Owner only) ────────────────────────────────

/** Keys the platform owner is allowed to toggle via the settings endpoint. */
const ALLOWED_FEATURE_FLAGS = ["ecomFramesSunglasses", "demoMode", "demoExpiry"];

/**
 * GET /api/tenants/:id/settings
 * Returns the featureFlags block for a specific tenant.
 */
export const getTenantSettings = async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id).select("tenantId storeInformation.storeName featureFlags demoMode demoExpiry").lean();
        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");

        const flags = { ...(tenant.featureFlags || {}) };
        flags.demoMode   = Boolean(tenant.demoMode || tenant.featureFlags?.demoMode);
        flags.demoExpiry = tenant.demoExpiry || tenant.featureFlags?.demoExpiry || null;

        return sendSuccessResponse(res, 200, {
            tenantId:     tenant.tenantId,
            storeName:    tenant.storeInformation?.storeName || null,
            featureFlags: flags,
        }, "Tenant settings retrieved successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "GET_TENANT_SETTINGS_ERROR", err.message);
    }
};

/**
 * PATCH /api/tenants/:id/settings
 * Allows the Platform Owner to toggle feature flags for a wholesaler.
 * Only keys present in ALLOWED_FEATURE_FLAGS are accepted.
 */
export const updateTenantSettings = async (req, res) => {
    try {
        const { featureFlags } = req.body;

        if (!featureFlags || typeof featureFlags !== "object" || Array.isArray(featureFlags)) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Request body must contain a 'featureFlags' object");
        }

        // Build a safe $set update using only whitelisted keys
        const setPayload = {};
        const rejected   = [];

        for (const [key, value] of Object.entries(featureFlags)) {
            if (!ALLOWED_FEATURE_FLAGS.includes(key)) {
                rejected.push(key);
                continue;
            }
            if (key === "demoExpiry") {
                const parsed = value ? new Date(value) : null;
                if (value && isNaN(parsed.getTime())) {
                    return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Feature flag '${key}' must be a valid date/time or null`);
                }
                setPayload[`featureFlags.${key}`] = parsed;
                setPayload[`demoExpiry`]          = parsed;
            } else if (typeof value !== "boolean") {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Feature flag '${key}' must be a boolean (true or false)`);
            } else {
                setPayload[`featureFlags.${key}`] = value;
                if (key === "demoMode") {
                    setPayload["demoMode"] = value;
                }
            }
        }

        if (Object.keys(setPayload).length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR",
                `No valid feature flags provided. Allowed flags: ${ALLOWED_FEATURE_FLAGS.join(", ")}`);
        }

        const tenant = await Tenant.findByIdAndUpdate(
            req.params.id,
            { $set: setPayload },
            { new: true, runValidators: true }
        ).select("tenantId storeInformation.storeName featureFlags demoMode demoExpiry").lean();

        if (!tenant) return sendErrorResponse(res, 404, "NOT_FOUND", "Tenant not found");

        const response = {
            tenantId:     tenant.tenantId,
            storeName:    tenant.storeInformation?.storeName || null,
            featureFlags: tenant.featureFlags,
        };

        if (rejected.length > 0) {
            response.warning = `Unknown flags ignored: ${rejected.join(", ")}`;
        }

        return sendSuccessResponse(res, 200, response, "Tenant feature flags updated successfully");
    } catch (err) {
        return sendErrorResponse(res, 500, "UPDATE_TENANT_SETTINGS_ERROR", err.message);
    }
};

