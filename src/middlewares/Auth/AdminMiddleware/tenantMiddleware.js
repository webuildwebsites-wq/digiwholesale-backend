import Tenant from "../../../models/Tenant/Tenant.model.js";

export const injectTenant = async (req, res, next) => {
    try {
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            req.tenant = null;
            return next();
        }

        const tenant = await Tenant.findOne({ tenantId, status: "ACTIVE" }).lean();

        if (!tenant) {
            return res.status(403).json({
                success: false,
                error: {
                    code:      "TENANT_INACTIVE",
                    message:   "Your workspace is inactive or suspended. Please contact support.",
                    timestamp: new Date().toISOString(),
                },
            });
        }

        req.tenant   = tenant;
        req.tenantId = tenantId;
        next();
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { code: "TENANT_MIDDLEWARE_ERROR", message: err.message, timestamp: new Date().toISOString() },
        });
    }
};
