import mongoose from 'mongoose';
import Department from '../../../../models/Auth/Department.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../../Utils/response/responseHandler.js';

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true, tenantId: req.user.tenantId })
      .select('name code description subRoles isActive')
      .lean();

    return sendSuccessResponse(res, 200, departments, 'Departments retrieved successfully');
  } catch (error) {
    console.error('Get all departments error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

// Get department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findOne({ _id: id, tenantId: req.user.tenantId }).lean();

    if (!department) {
      return sendErrorResponse(res, 404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }

    return sendSuccessResponse(res, 200, department, 'Department retrieved successfully');
  } catch (error) {
    console.error('Get department by ID error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

// Get sub-roles by department ID
export const getSubRolesByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const department = await Department.findOne({ _id: departmentId, tenantId: req.user.tenantId })
      .select('name subRoles')
      .lean();

    if (!department) {
      return sendErrorResponse(res, 404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }

    const activeSubRoles = department.subRoles.filter(sr => sr.isActive);

    return sendSuccessResponse(
      res,
      200,
      {
        departmentName: department.name,
        subRoles: activeSubRoles
      },
      'Sub-roles retrieved successfully'
    );
  } catch (error) {
    console.error('Get sub-roles error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

// Create department (SuperAdmin only)
export const createDepartment = async (req, res) => {
  try {
    const { name, code, description, subRoles } = req.body;

    if (!name || !code) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Name and code are required');
    }

    const existingDepartment = await Department.findOne({
      tenantId: req.user.tenantId,
      $or: [{ name: name.toUpperCase() }, { code: code.toUpperCase() }]
    });

    if (existingDepartment) {
      return sendErrorResponse(res, 409, 'DEPARTMENT_EXISTS', 'Department with this name or code already exists');
    }

    const department = await Department.create({
      name: name.toUpperCase(),
      code: code.toUpperCase(),
      description,
      subRoles: subRoles || [],
      createdBy: req.user.id,
      tenantId: req.user.tenantId,
    });

    return sendSuccessResponse(res, 201, department, 'Department created successfully');
  } catch (error) {
    console.error('Create department error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

// Add sub-role to department (SuperAdmin or Department Admin)
export const addSubRole = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { name, code, description } = req.body;

    if (!name || !code) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Name and code are required');
    }

    const department = await Department.findOne({ _id: departmentId, tenantId: req.user.tenantId });

    if (!department) {
      return sendErrorResponse(res, 404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }

    // Check if user is SuperAdmin or Admin of this department
    const userEmployeeType = req.user.EmployeeType?.name || req.user.EmployeeType;
    const userDepartmentId = req.user.Department?.refId?.toString();

    if (userEmployeeType !== 'SUPERADMIN' && 
        (userEmployeeType !== 'ADMIN' || userDepartmentId !== departmentId)) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to add sub-roles to this department');
    }

    // Check if sub-role already exists
    const existingSubRole = department.subRoles.find(
      sr => sr.code.toUpperCase() === code.toUpperCase()
    );

    if (existingSubRole) {
      return sendErrorResponse(res, 409, 'SUBROLE_EXISTS', 'Sub-role with this code already exists');
    }

    department.subRoles.push({
      name: name.trim(),
      code: code.toUpperCase(),
      description,
      isActive: true
    });

    department.updatedBy = req.user.id;
    await department.save();

    return sendSuccessResponse(res, 200, department, 'Sub-role added successfully');
  } catch (error) {
    console.error('Add sub-role error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

// Update sub-role
export const updateSubRole = async (req, res) => {
  try {
    const { departmentId, subRoleId } = req.params;
    const { name, code, description, isActive } = req.body;

    const department = await Department.findOne({ _id: departmentId, tenantId: req.user.tenantId });

    if (!department) {
      return sendErrorResponse(res, 404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }

    // Check permissions
    const userEmployeeType = req.user.EmployeeType?.name || req.user.EmployeeType;
    const userDepartmentId = req.user.Department?.refId?.toString();

    if (userEmployeeType !== 'SUPERADMIN' && 
        (userEmployeeType !== 'ADMIN' || userDepartmentId !== departmentId)) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to update sub-roles in this department');
    }

    const subRole = department.subRoles.id(subRoleId);

    if (!subRole) {
      return sendErrorResponse(res, 404, 'SUBROLE_NOT_FOUND', 'Sub-role not found');
    }

    if (name) subRole.name = name.trim();
    if (code) subRole.code = code.toUpperCase();
    if (description !== undefined) subRole.description = description;
    if (isActive !== undefined) subRole.isActive = isActive;

    department.updatedBy = req.user.id;
    await department.save();

    return sendSuccessResponse(res, 200, department, 'Sub-role updated successfully');
  } catch (error) {
    console.error('Update sub-role error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

// Delete sub-role (soft delete by setting isActive to false)
export const deleteSubRole = async (req, res) => {
  try {
    const { departmentId, subRoleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(departmentId) ||!mongoose.Types.ObjectId.isValid(subRoleId)) {
      return sendErrorResponse(res,400,"INVALID_ID","Invalid department or sub-role id");
    }

    const department = await Department.findOne({ _id: departmentId, tenantId: req.user.tenantId });

    if (!department) {
      return sendErrorResponse(res,404,"DEPARTMENT_NOT_FOUND","Department not found");
    }

    const userEmployeeType = req.user.EmployeeType;
    const userDepartmentId = req.user.Department?.refId?.toString();

    const isSuperAdmin = userEmployeeType === "SUPERADMIN";
    const isDepartmentAdmin = userEmployeeType === "ADMIN" &&  userDepartmentId === departmentId;
    if (!isSuperAdmin && !isDepartmentAdmin) {
      return sendErrorResponse(res,403,"FORBIDDEN","You do not have permission to delete sub-role");
    }

    const subRole = department.subRoles.id(subRoleId);

    if (!subRole) {
      return sendErrorResponse(res,404,"SUBROLE_NOT_FOUND","Sub-role not found");
    }
    subRole.deleteOne();
    department.updatedBy = req.user.id;
    await department.save();

    return sendSuccessResponse(res, 200, null, "Sub-role deleted successfully");
  } catch (error) {
    console.error("Delete sub-role error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const department = await Department.findOne({ _id: id, tenantId: req.user.tenantId });

    if (!department) {
      return sendErrorResponse(res, 404, 'DEPARTMENT_NOT_FOUND', 'Department not found');
    }

    if (name) department.name = name.toUpperCase();
    if (code) department.code = code.toUpperCase();
    if (description !== undefined) department.description = description;
    if (isActive !== undefined) department.isActive = isActive;

    department.updatedBy = req.user.id;
    await department.save();

    return sendSuccessResponse(res, 200, department, 'Department updated successfully');
  } catch (error) {
    console.error('Update department error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};
