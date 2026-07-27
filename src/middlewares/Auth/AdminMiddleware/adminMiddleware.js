import jwt from 'jsonwebtoken';
import employeeSchema from '../../../models/Auth/Employee.js';
import Customer from '../../../models/Auth/Customer.js';
import dotenv from 'dotenv';
dotenv.config();

export const ProtectUser = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Not authorized to access this route', timestamp: new Date().toISOString() },
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      let user = await employeeSchema.findById(decoded.id);

      if (!user || !user.isActive) {
        user = await Customer.findById(decoded.id);
        if (!user || !user.status?.isActive) {
          return res.status(401).json({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User no longer exists or is inactive', timestamp: new Date().toISOString() },
          });
        }
      }

      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          error: { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked', timestamp: new Date().toISOString() },
        });
      }

      const userObj = user.toObject();
      req.user = {
        id:               user._id,
        EmployeeType:     decoded.EmployeeType,
        AccountType:      decoded.AccountType  || 'EMPLOYEE',
        tenantId:         userObj.tenantId      || null,
        ...userObj,
        EmployeeType:     decoded.EmployeeType,
        Department:       userObj.Department?.name || userObj.Department,
        zone:             userObj.zone?.name        || userObj.zone,
        pageAccess:       userObj.pageAccess        || [],
        accessPermissions:userObj.accessPermissions || [],
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Not authorized to access this route', timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Authentication error', timestamp: new Date().toISOString() },
    });
  }
};
