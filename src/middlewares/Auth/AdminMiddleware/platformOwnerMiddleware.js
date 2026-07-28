import jwt from "jsonwebtoken";
import Employee from "../../../models/Auth/Employee.js";

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

        const user = await Employee.findById(decoded.id);

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: { code: "USER_NOT_FOUND", message: "User not found or inactive", timestamp: new Date().toISOString() },
            });
        }

        if (user.EmployeeType !== "PLATFORM_OWNER") {
            return res.status(403).json({
                success: false,
                error: { code: "FORBIDDEN", message: "Platform Owner access required", timestamp: new Date().toISOString() },
            });
        }

        req.user = {
            id:           user._id,
            EmployeeType: user.EmployeeType,
            AccountType:  "PLATFORM_OWNER",
            ...user.toObject(),
        };

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: { code: "INVALID_TOKEN", message: err.message, timestamp: new Date().toISOString() },
        });
    }
};
