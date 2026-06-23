import { sendErrorResponse } from '../../../Utils/response/responseHandler.js';

export const checkPageAccess = (pageName) => {
  return (req, res, next) => {
    const userPageAccess = req.user?.pageAccess || [];

    if (req.user?.EmployeeType === 'SUPERADMIN' && userPageAccess.length === 0) {
      return next();
    }

    if (!userPageAccess.includes(pageName)) {
      return sendErrorResponse(res, 403, 'ACCESS_DENIED', 'Access Denied');
    }

    next();
  };
};

export const checkPermission = (permissionName) => {
  return (req, res, next) => {
    const userPermissions = req.user?.accessPermissions || [];

    if (req.user?.EmployeeType === 'SUPERADMIN' && userPermissions.length === 0) {
      return next();
    }

    if (!userPermissions.includes(permissionName)) {
      return sendErrorResponse(res, 403, 'ACCESS_DENIED', 'Access Denied');
    }

    next();
  };
};
