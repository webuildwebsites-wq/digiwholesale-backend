import jwt from 'jsonwebtoken';
import Customer from '../../../models/Auth/Customer.js';
import Tenant from '../../../models/Tenant/Tenant.model.js';
import dotenv from 'dotenv';
import employeeSchema from '../../../models/Auth/Employee.js';
dotenv.config();

export const protectCustomer = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies.token) {
      token = req.cookies.token;
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Not authorized to access this route',
          timestamp: new Date().toISOString()
        }
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const customer = await Customer.findById(decoded.id);
      if (!customer || !customer.status.isActive || customer.status.isSuspended) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Customer account not found or is inactive or suspended',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (customer.isLocked) {
        return res.status(423).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Account is temporarily locked',
            timestamp: new Date().toISOString()
          }
        });
      }

      const customerObj = customer.toObject();

      if (!customerObj.tenantId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'NO_TENANT',
            message: 'Account is not associated with any workspace. Please contact support.',
            timestamp: new Date().toISOString()
          }
        });
      }

      const tenant = await Tenant.findOne({ tenantId: customerObj.tenantId }).lean();
      if (!tenant || tenant.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'TENANT_SUSPENDED',
            message: 'Your workspace has been suspended. Please contact support.',
            timestamp: new Date().toISOString()
          }
        });
      }

      req.user = {
        id: customer._id,
        AccountType: 'CUSTOMER',
        ...customerObj
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Not authorized to access this route',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Customer auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

export const protectCustomerCreation = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "NO_TOKEN",
          message: "Not authorized to access this route",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.AccountType !== "EMPLOYEE") {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only employees can create customers",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const employee = await employeeSchema.findById(decoded.id);

    if (!employee) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_USER",
          message: "Employee not found",
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.user = {
      id: employee._id,
      AccountType: decoded.AccountType,
      EmployeeType: decoded.EmployeeType,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error.message);

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Not authorized to access this route",
        timestamp: new Date().toISOString(),
      },
    });
  }
};
