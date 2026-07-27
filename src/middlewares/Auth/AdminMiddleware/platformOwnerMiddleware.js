import jwt from "jsonwebtoken";
import PlatformOwner from "../../../models/Tenant/PlatformOwner.model.js";

export const protectPlatformOwner = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: { code: "NO_TOKEN", message: "Not authorized", timestamp: new Date().toISOString() },
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.AccountType !== "PLATFORM_OWNER") {
            return res.status(403).json({
                success: false,
                error: { code: "FORBIDDEN", message: "Platform Owner access required", timestamp: new Date().toISOString() },
            });
        }

        const owner = await PlatformOwner.findById(decoded.id);
        if (!owner || !owner.isActive) {
            return res.status(401).json({
                success: false,
                error: { code: "OWNER_NOT_FOUND", message: "Platform owner not found or inactive", timestamp: new Date().toISOString() },
            });
        }

        req.owner = owner;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: { code: "INVALID_TOKEN", message: err.message, timestamp: new Date().toISOString() },
        });
    }
};
