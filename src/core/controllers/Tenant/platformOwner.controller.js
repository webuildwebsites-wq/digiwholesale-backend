import jwt from "jsonwebtoken";
import crypto from "crypto";
import PlatformOwner from "../../../models/Tenant/PlatformOwner.model.js";
import Tenant from "../../../models/Tenant/Tenant.model.js";
import Employee from "../../../models/Auth/Employee.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { generateEmployeeCode } from "../../../Utils/Auth/customerAuthUtils.js";
import dotenv from "dotenv";
dotenv.config();

const generateTenantId = (businessName) => {
    const slug = businessName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)
        .padEnd(3, "X");
    const rand = Math.random().toString(36).toUpperCase().slice(2, 7);
    return `TEN-${slug}-${rand}`;
};

const signToken = (id) =>
    jwt.sign({ id, AccountType: "PLATFORM_OWNER" }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || "24h",
    });

export const platformOwnerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Email and password are required");
        }

        const owner = await PlatformOwner.findOne({ email: email.toLowerCase() }).select("+password");
        if (!owner || !owner.isActive) {
            return sendErrorResponse(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
        }

        const valid = await owner.comparePassword(password);
        if (!valid) {
            return sendErrorResponse(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
        }

        owner.lastLogin = new Date();
        await owner.save({ validateBeforeSave: false });

        const token = signToken(owner._id);

        const ownerObj = owner.toObject();
        delete ownerObj.password;

        return res.status(200).json({
            success: true,
            data: {
                owner: ownerObj,
                token,
                AccountType: "PLATFORM_OWNER",
            },
        });
    } catch (err) {
        return sendErrorResponse(res, 500, "LOGIN_ERROR", err.message);
    }
};

export const registerTenant = async (req, res) => {
    try {
        const {
            businessName, gstNumber, contactPerson, mobile, email,
            address, state, city, pincode, website, description, themeColor,
            logo, banner,
            superAdminName, superAdminEmail, superAdminPassword, superAdminPhone,
        } = req.body;

        if (!businessName || !contactPerson || !mobile || !email) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "businessName, contactPerson, mobile, email are required");
        }
        if (!superAdminName || !superAdminEmail || !superAdminPassword) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "superAdminName, superAdminEmail, superAdminPassword are required for the first Super Admin");
        }

        const existingTenant = await Tenant.findOne({ email: email.toLowerCase() });
        if (existingTenant) {
            return sendErrorResponse(res, 409, "TENANT_EXISTS", "A tenant with this email already exists");
        }

        const existingEmployee = await Employee.findOne({ email: superAdminEmail.toLowerCase() });
        if (existingEmployee) {
            return sendErrorResponse(res, 409, "EMPLOYEE_EXISTS", "An employee with the Super Admin email already exists");
        }

        let tenantId = generateTenantId(businessName);
        while (await Tenant.findOne({ tenantId })) {
            tenantId = generateTenantId(businessName);
        }

        const tenant = await Tenant.create({
            tenantId,
            businessName:  businessName.trim(),
            gstNumber:     gstNumber     || null,
            contactPerson: contactPerson.trim(),
            mobile:        mobile.trim(),
            email:         email.toLowerCase().trim(),
            address:       address       || null,
            state:         state         || null,
            city:          city          || null,
            pincode:       pincode       || null,
            branding: {
                logo:        logo        || null,
                banner:      banner      || null,
                themeColor:  themeColor  || "#1e40af",
                description: description || null,
                website:     website     || null,
            },
            status:    "ACTIVE",
            createdBy: req.owner._id,
        });

        let employeeCode = generateEmployeeCode(superAdminName);
        while (await Employee.findOne({ employeeCode })) {
            employeeCode = generateEmployeeCode(superAdminName);
        }

        const superAdmin = new Employee({
            employeeName:  superAdminName.trim(),
            username:      superAdminEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 15) || `admin${Date.now()}`,
            email:         superAdminEmail.toLowerCase().trim(),
            password:      superAdminPassword,
            phone:         superAdminPhone || mobile,
            address:       address         || "N/A",
            country:       "India",
            EmployeeType:  "SUPERADMIN",
            employeeCode,
            tenantId:      tenantId,
            isActive:      true,
            pageAccess:    [],
            accessPermissions: [],
        });
        await superAdmin.save();

        const tenantObj    = tenant.toObject();
        const superAdminObj = superAdmin.toObject();
        delete superAdminObj.password;

        return sendSuccessResponse(res, 201, {
            tenant: tenantObj,
            superAdmin: superAdminObj,
        }, `Tenant "${businessName}" registered successfully with tenantId: ${tenantId}`);

    } catch (err) {
        console.error("registerTenant error:", err);
        return sendErrorResponse(res, 500, "REGISTER_TENANT_ERROR", err.message);
    }
};

export const getAllTenants = async (req, res) => {
    try {
        const page   = Math.max(parseInt(req.query.page)   || 1, 1);
        const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
        const skip   = (page - 1) * limit;
        const { status, search } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (search?.trim()) {
            const r = { $regex: search.trim(), $options: "i" };
            filter.$or = [
                { businessName: r },
                { tenantId:     r },
                { email:        r },
                { mobile:       r },
            ];
        }

        const [tenants, total] = await Promise.all([
            Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Tenant.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            tenants,
            pagination: {
                currentPage: page,
                totalPages:  Math.ceil(total / limit),
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
            "businessName", "gstNumber", "contactPerson", "mobile",
            "address", "state", "city", "pincode",
            "branding", "subscription",
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
