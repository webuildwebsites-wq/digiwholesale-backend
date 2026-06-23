import { sendErrorResponse } from '../../../Utils/response/responseHandler.js';

export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.EmployeeType !== 'SUPERADMIN') {
    return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. SuperAdmin privileges required.');
  }
  next();
};

export const requireSubAdminOrHigher = (req, res, next) => {
  if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.EmployeeType)) {
    return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Admin or higher privileges required.');
  }
  next();
};

export const requireSupervisorOrHigher = (req, res, next) => {
  if (!['SUPERADMIN', 'ADMIN', 'SUPERVISOR'].includes(req.user?.EmployeeType)) {
    return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Supervisor or higher privileges required.');
  }
  next();
};

export const canManageEmployee = (req, res, next) => {
  if (req.user?.EmployeeType === 'SUPERADMIN') return next();

  if (!['SUPERADMIN', 'ADMIN', 'SUPERVISOR'].includes(req.user?.EmployeeType)) {
    return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Employee management privileges required.');
  }
  next();
};
