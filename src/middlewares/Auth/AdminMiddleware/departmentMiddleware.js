import { sendErrorResponse } from '../../../Utils/response/responseHandler.js';

export const requireSalesDepartment = (req, res, next) => {
  const department = req.user.Department || req.user.Department?.name;

  if (department !== 'SALES') {
    return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Sales department access required.');
  }
  next();
};

export const requireFinanceDepartment = (req, res, next) => {
  const department = req.user.Department || req.user.Department?.name;
  const employeeType = req.user.EmployeeType;

  if (employeeType === 'SUPERADMIN' || ['SALES', 'FINANCE'].includes(department)) {
    return next();
  }

  return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Sales, Finance department or SuperAdmin access required.');
};

export const requireSalesOrFinance = (req, res, next) => {
  const department = req.user.Department || req.user.Department?.name;

  if (!['SALES', 'FINANCE'].includes(department)) {
    return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Sales or Finance department access required.');
  }
  next();
};

export const requireSalesFinanceOrSuperAdmin = (req, res, next) => {
  const department = req.user.Department || req.user.Department?.name;
  const employeeType = req.user.EmployeeType;

  if (employeeType === 'SUPERADMIN' || ['SALES', 'FINANCE'].includes(department)) {
    return next();
  }

  return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Sales, Finance department or SuperAdmin access required.');
};

export const requireCanEditCustomer = (req, res, next) => {
  const department = (req.user?.Department?.name || req.user?.Department || '').toUpperCase();
  const employeeType = (req.user?.EmployeeType || req.user?.role || '').toUpperCase();
  const subRoles = Array.isArray(req.user?.subRoles) ? req.user.subRoles : [];
  const isSalesHead = subRoles.some(r => (r.code || r.name || '').toUpperCase().includes('SALES_HEAD'))
    || (req.user?.SubRole || req.user?.subRole || '').toUpperCase().includes('SALES_HEAD')
    || (department === 'SALES' && ['HEAD', 'MANAGER', 'SALES_HEAD'].includes(employeeType));

  // 1. Super Admin or Platform Owner
  if (['SUPERADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER'].includes(employeeType) || req.user?.isPlatformOwner || req.user?.isSuperAdmin) {
    return next();
  }
  // 2. Admin
  if (employeeType === 'ADMIN') {
    return next();
  }
  // 3. Accounts / Finance department
  if (['ACCOUNTS', 'ACCOUNTING', 'FINANCE'].includes(department)) {
    return next();
  }
  // 4. Sales Head department
  if (isSalesHead || (department === 'SALES' && ['HEAD', 'MANAGER', 'SALES_HEAD'].includes(employeeType))) {
    return next();
  }

  // Fallback: if user has UPDATE_CUSTOMER permission
  const userPermissions = req.user?.accessPermissions || [];
  if (userPermissions.includes('UPDATE_CUSTOMER')) {
    return next();
  }

  return sendErrorResponse(res, 403, 'FORBIDDEN', 'Access denied. Only Super Admin, Admin, Accounts department, and Sales Head can edit customer details.');
};

export const attachDepartmentInfo = (req, res, next) => {
  if (req.user) {
    req.userDepartment = req.user.Department || req.user.Department?.name;
  }
  next();
};
