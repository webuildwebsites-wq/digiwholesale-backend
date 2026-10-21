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

        // Block API access if workspace subscription has expired (except PLATFORM_OWNER)
        if (req.user?.EmployeeType !== 'PLATFORM_OWNER') {
            const rawExpiry = tenant.storeInformation?.expiryDate || tenant.subscription?.expiresAt;
            if (rawExpiry) {
                const expDate = new Date(rawExpiry);
                if (!isNaN(expDate.getTime()) && new Date() > expDate) {
                    const formattedDate = expDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    });
                    return res.status(403).json({
                        success: false,
                        error: {
                            code:      "SUBSCRIPTION_EXPIRED",
                            message:   `Your workspace subscription expired on ${formattedDate}. Panel access has been disabled. Please contact DigiBySR billing to renew.`,
                            timestamp: new Date().toISOString(),
                        },
                    });
                }
            }
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
