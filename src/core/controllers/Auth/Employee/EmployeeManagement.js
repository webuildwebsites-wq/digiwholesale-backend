import { sendSuccessResponse, sendErrorResponse } from '../../../../Utils/response/responseHandler.js';
import { generateEmployeeCode, generateRandomPassword } from '../../../../Utils/Auth/customerAuthUtils.js';
import employeeSchema from '../../../../models/Auth/Employee.js';
import Department from '../../../../models/Auth/Department.js';
import Location from '../../../../models/Location/Location.js';
import SpecificLab from '../../../../models/Product/SpecificLab.js';
import mongoose from 'mongoose';
import employeeDraftSchema from '../../../../models/Auth/EmployeeDraft.js';

const updateHierarchicalRelationships = async (employeeId, supervisorId, teamLeadId) => {
  try {
    if (supervisorId) {
      await employeeSchema.findByIdAndUpdate(
        supervisorId,
        { $addToSet: { employeesUnderMe: employeeId } },
        { new: true }
      );
    }

    if (teamLeadId) {
      await employeeSchema.findByIdAndUpdate(
        teamLeadId,
        { $addToSet: { employeesUnderMe: employeeId } },
        { new: true }
      );

      if (supervisorId) {
        await employeeSchema.findByIdAndUpdate(
          supervisorId,
          { $addToSet: { teamLeadsUnderMe: teamLeadId } },
          { new: true }
        );
      }
    }
  } catch (error) {
    console.error('Error updating hierarchical relationships:', error);
    throw error;
  }
};

const removeHierarchicalRelationships = async (employeeId, oldSupervisorId, oldTeamLeadId) => {
  try {

    if (oldSupervisorId) {
      await employeeSchema.findByIdAndUpdate(
        oldSupervisorId,
        { $pull: { employeesUnderMe: employeeId } }
      );
    }

    if (oldTeamLeadId) {
      await employeeSchema.findByIdAndUpdate(
        oldTeamLeadId,
        { $pull: { employeesUnderMe: employeeId } }
      );

      const teamLead = await employeeSchema.findById(oldTeamLeadId);

      if (teamLead?.employeesUnderMe?.length === 0 && oldSupervisorId) {
        await employeeSchema.findByIdAndUpdate(
          oldSupervisorId,
          { $pull: { teamLeadsUnderMe: oldTeamLeadId } }
        );
      }
    }

  } catch (error) {
    console.error('Error removing hierarchical relationships:', error);
    throw error;
  }
};

export const createEmployee = async (req, res) => {
  try {
    const { employeeType, username, employeeName, email, password, phone, address, department, departmentRefId, country,
      pincode, expiry, zone, zoneRefId, aadharCard, panCard, lab, labRefId, subRoles, aadharCardImg, panCardImg, draftEmployeeId, employeeProfileImg,
      pageAccess, accessPermissions } = req.body;

    let assignedSupervisor = null;

    if (!employeeType || !username || !employeeName || !country || !email || !password || !phone || !address) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'All required fields must be provided');
    }

    if (expiry) {
      const expiryDate = new Date(expiry);
      const currentDate = new Date();
      const oneDayFromNow = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      if (expiryDate < oneDayFromNow) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Expiry date must be at least one day from current time');
      }
    }

    // Validate ObjectId formats
    if (departmentRefId && !mongoose.Types.ObjectId.isValid(departmentRefId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid department ID format');
    }

    if (zoneRefId && !mongoose.Types.ObjectId.isValid(zoneRefId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid zone ID format');
    }

    // if (labRefId && !mongoose.Types.ObjectId.isValid(labRefId)) {
    //   return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid lab ID format');
    // }

    if (subRoles && Array.isArray(subRoles)) {
      for (const subRole of subRoles) {
        if (subRole.refId && !mongoose.Types.ObjectId.isValid(subRole.refId)) {
          return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid sub-role ID format: ${subRole.name || 'unknown'}`);
        }
      }
    }

    const validEmployeeTypes = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'TEAMLEAD', 'EMPLOYEE'];
    if (!validEmployeeTypes.includes(employeeType.toUpperCase())) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid employee type. Must be ADMIN, SUPERVISOR, TEAMLEAD, or EMPLOYEE');
    }

    if (employeeType.toUpperCase() === 'ADMIN' && req.user.EmployeeType !== 'SUPERADMIN') {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'Only SuperAdmin can create Admin');
    }

    if (employeeType.toUpperCase() !== 'SUPERADMIN') {
      if (!department && employeeType.toUpperCase() !== 'ADMIN') {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Department is required');
      }

      if (department && departmentRefId) {
        const departmentDoc = await Department.findById(departmentRefId);
        if (!departmentDoc) {
          return sendErrorResponse(
            res,
            404,
            'INVALID_REF_ID',
            `Department with refId ${departmentRefId} does not exist`
          );
        }
        if (departmentDoc.name !== department.toUpperCase()) {
          return sendErrorResponse(
            res,
            400,
            'NAME_MISMATCH',
            `Incorrect department name for refId ${departmentRefId}. Expected: ${departmentDoc.name}, Received: ${department}`
          );
        }

        if (employeeType.toUpperCase() === 'ADMIN') {
      const existingAdmin = await employeeSchema.findOne({
            EmployeeType: 'ADMIN',
            tenantId: req.user.tenantId,
            'Department.refId': departmentRefId,
            isActive: true
          });

          // if (existingAdmin) {
          //   return sendErrorResponse(res, 409, 'ADMIN_EXISTS', `An admin already exists for ${department} department`);
          // }
        }
      }

      if ((req.user.EmployeeType === 'SUPERADMIN' || req.user.EmployeeType === 'ADMIN') && employeeType.toUpperCase() !== 'ADMIN') {
        const userDepartmentId = req.user.Department?.refId?.toString();
        if (userDepartmentId && departmentRefId && userDepartmentId !== departmentRefId) {
          return sendErrorResponse(res, 403, 'FORBIDDEN', 'Admin can only create employees in their own department');
        }
      }
    }

    if (subRoles && Array.isArray(subRoles) && subRoles.length > 0) {
      if (!departmentRefId) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Department reference ID is required when assigning sub-roles');
      }

      const departmentDoc = await Department.findById(departmentRefId);
      if (!departmentDoc) {
        return sendErrorResponse(
          res,
          404,
          'INVALID_REF_ID',
          `Department with refId ${departmentRefId} does not exist`
        );
      }

      for (const subRole of subRoles) {
        if (!subRole.refId) {
          return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Sub-role refId is required');
        }
        if (!subRole.name) {
          return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Sub-role name is required');
        }

        const subRoleExists = departmentDoc.subRoles.id(subRole.refId);
        if (!subRoleExists) {
          return sendErrorResponse(
            res,
            404,
            'INVALID_REF_ID',
            `Sub-role with refId ${subRole.refId} does not exist in department ${department}`
          );
        }

        if (subRoleExists.name !== subRole.name) {
          return sendErrorResponse(
            res,
            400,
            'NAME_MISMATCH',
            `Incorrect sub-role name for refId ${subRole.refId}. Expected: ${subRoleExists.name}, Received: ${subRole.name}`
          );
        }

        if (!subRoleExists.isActive) {
          return sendErrorResponse(
            res,
            400,
            'INACTIVE_SUBROLE',
            `Sub-role ${subRole.name} is not active`
          );
        }
      }
    }

    if (['EMPLOYEE', 'SUPERVISOR', 'TEAMLEAD'].includes(employeeType.toUpperCase()) &&
      department && department.toUpperCase() === 'SALES' && !zone) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Zone is required for SALES department employees, supervisors, and team leads');
    }

    if (zone && zoneRefId) {
      const locationDoc = await Location.findById(zoneRefId);
      if (!locationDoc) {
        return sendErrorResponse(
          res,
          404,
          'INVALID_REF_ID',
          `Zone with refId ${zoneRefId} does not exist`
        );
      }
      if (!locationDoc.isActive) {
        return sendErrorResponse(
          res,
          400,
          'ZONE_INACTIVE',
          'Zone is not active'
        );
      }
      if (locationDoc.zone !== zone.toUpperCase()) {
        return sendErrorResponse(
          res,
          400,
          'NAME_MISMATCH',
          `Incorrect zone name for refId ${zoneRefId}. Expected: ${locationDoc.zone}, Received: ${zone}`
        );
      }
    }

    // if (lab && labRefId) {
    //   const labDoc = await SpecificLab.findById(labRefId);
    //   if (!labDoc) {
    //     return sendErrorResponse(
    //       res,
    //       404,
    //       'INVALID_REF_ID',
    //       `Lab with refId ${labRefId} does not exist`
    //     );
    //   }
    //   if (labDoc.name !== lab) {
    //     return sendErrorResponse(
    //       res,
    //       400,
    //       'NAME_MISMATCH',
    //       `Incorrect lab name for refId ${labRefId}. Expected: ${labDoc.name}, Received: ${lab}`
    //     );
    //   }
    // }

    let assignedTeamLead = null;

    if (employeeType.toUpperCase() === 'EMPLOYEE') {
      const isSalesDepartment = department.toUpperCase() === 'SALES';

      const supervisorQuery = {
        EmployeeType: 'SUPERVISOR',
        'Department.name': department.toUpperCase(),
        isActive: true,
        tenantId: req.user.tenantId,
      };

      if (isSalesDepartment && zone) {
        supervisorQuery['zone.name'] = zone.toUpperCase();
      } else if (!isSalesDepartment && subRoles && subRoles.length > 0) {
        supervisorQuery['subRoles.refId'] = { $in: subRoles.map(sr => sr.refId) };
      }

      assignedSupervisor = await employeeSchema.findOne(supervisorQuery);

      const teamLeadQuery = {
        EmployeeType: 'TEAMLEAD',
        'Department.name': department.toUpperCase(),
        isActive: true,
        tenantId: req.user.tenantId,
      };

      if (isSalesDepartment && zone) {
        teamLeadQuery['zone.name'] = zone.toUpperCase();
      } else if (!isSalesDepartment && subRoles && subRoles.length > 0) {
        teamLeadQuery['subRoles.refId'] = { $in: subRoles.map(sr => sr.refId) };
      }

      assignedTeamLead = await employeeSchema.findOne(teamLeadQuery);
    }

    if (employeeType.toUpperCase() === 'TEAMLEAD') {
      const isSalesDepartment = department.toUpperCase() === 'SALES';

      const supervisorQuery = {
        EmployeeType: 'SUPERVISOR',
        'Department.name': department.toUpperCase(),
        isActive: true,
        tenantId: req.user.tenantId,
      };

      if (isSalesDepartment && zone) {
        supervisorQuery['zone.name'] = zone.toUpperCase();
      } else if (!isSalesDepartment && subRoles && subRoles.length > 0) {
        supervisorQuery['subRoles.refId'] = { $in: subRoles.map(sr => sr.refId) };
      }

      assignedSupervisor = await employeeSchema.findOne(supervisorQuery);
    }

    const existingUser = await employeeSchema.findOne({
      tenantId: req.user.tenantId,
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return sendErrorResponse(res, 409, 'USER_EXISTS', 'Employee with this email or username already exists');
    }

    let employeeCode = generateEmployeeCode(employeeName);
    let codeExists = true;
    while (codeExists) {
      const existing = await employeeSchema.findOne({ employeeCode });
      if (!existing) {
        codeExists = false;
      } else {
        employeeCode = generateEmployeeCode(employeeName);
      }
    }

    // const finalPassword = password || generateRandomPassword();

    const userData = {
      username,
      employeeName,
      email,
      password,
      phone,
      address,
      country,
      pincode,
      aadharCard,
      panCard,
      expiry,
      employeeCode,
      EmployeeType: employeeType.toUpperCase(),
      createdBy: req.user.id,
      isActive: true,
      aadharCardImg,
      panCardImg,
      employeeProfileImg,
      pageAccess:        Array.isArray(pageAccess)        ? pageAccess        : [],
      accessPermissions: Array.isArray(accessPermissions) ? accessPermissions : [],
      tenantId:          req.user.tenantId || null,
    };

    if (employeeType.toUpperCase() !== 'SUPERADMIN') {
      if (department && departmentRefId) {
        userData.Department = {
          name: department.toUpperCase(),
          refId: departmentRefId
        };
      } else if (employeeType.toUpperCase() === 'ADMIN') {
        userData.Department = {
          name: 'ALL',
          refId: null
        };
      }
    }

    if (subRoles && subRoles.length > 0 && departmentRefId) {
      const deptDoc = await Department.findById(departmentRefId);
      userData.subRoles = subRoles.map(sr => {
        const match = deptDoc?.subRoles?.id(sr.refId);
        return {
          name: match?.name,
          refId: match?._id,
          code: match?.code,
          description: match?.description,
        };
      });
    } else {
      userData.subRoles = subRoles || [];
    }

    // if (lab && labRefId) {
    //   userData.lab = {
    //     name: lab.toUpperCase(),
    //     refId: labRefId
    //   };
    // }

    if (zone && zoneRefId) {
      userData.zone = {
        name: zone.toUpperCase(),
        refId: zoneRefId
      };
    }

    if (employeeType.toUpperCase() === 'EMPLOYEE' && assignedSupervisor) {
      userData.supervisor = {
        name: assignedSupervisor.employeeName,
        refId: assignedSupervisor._id
      };

      if (assignedTeamLead) {
        userData.teamLead = {
          name: assignedTeamLead.employeeName,
          refId: assignedTeamLead._id
        };
      }
    }

    if (employeeType.toUpperCase() === 'TEAMLEAD' && assignedSupervisor) {
      userData.supervisor = {
        name: assignedSupervisor.employeeName,
        refId: assignedSupervisor._id
      };
    }

    const newUser = new employeeSchema(userData);
    await newUser.save();

    if (employeeType.toUpperCase() === 'EMPLOYEE') {
      await updateHierarchicalRelationships(
        newUser._id,
        assignedSupervisor?._id,
        assignedTeamLead?._id
      );
    }

    if (employeeType.toUpperCase() === 'TEAMLEAD' && assignedSupervisor) {
      await employeeSchema.findByIdAndUpdate(
        assignedSupervisor._id,
        { $addToSet: { teamLeadsUnderMe: newUser._id } },
        { new: true }
      );
    }

    if (draftEmployeeId) {
      try {
        const deletedDraft = await employeeDraftSchema.findByIdAndDelete(draftEmployeeId);
        if (deletedDraft) {
          console.log(`Draft employee ${draftEmployeeId} deleted successfully`);
        } else {
          console.warn(`Draft employee ${draftEmployeeId} not found for deletion`);
        }
      } catch (draftError) {
        console.error(`Error deleting draft employee ${draftEmployeeId}:`, draftError);
      }
    }

    const userResponse = newUser.toObject();
    delete userResponse.password;

    return sendSuccessResponse(res, 201, { employee: userResponse }, `${employeeType.charAt(0).toUpperCase() + employeeType.slice(1).toLowerCase()} created successfully`);

  } catch (error) {
    console.error('Create employee error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldLabels = { username: 'Username', email: 'Email', employeeCode: 'Employee code' };
      const label = fieldLabels[field] || field;
      return sendErrorResponse(res, 409, 'DUPLICATE_ERROR', `${label} '${error.keyValue[field]}' is already taken`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create employee');
  }
};

export const createDraftEmployee = async (req, res) => {
  try {
    const { employeeType, username, employeeName, email, password, phone, address, department, departmentRefId, country,
      pincode, expiry, zone, zoneRefId, aadharCard, panCard, lab, labRefId, subRoles, aadharCardImg, panCardImg, employeeProfileImg } = req.body;

    let assignedSupervisor = null;

    if (departmentRefId && !mongoose.Types.ObjectId.isValid(departmentRefId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid department ID format');
    }

    if (zoneRefId && !mongoose.Types.ObjectId.isValid(zoneRefId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid zone ID format');
    }

    // if (labRefId && !mongoose.Types.ObjectId.isValid(labRefId)) {
    //   return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid lab ID format');
    // }

    if (subRoles && Array.isArray(subRoles)) {
      for (const subRole of subRoles) {
        if (subRole.refId && !mongoose.Types.ObjectId.isValid(subRole.refId)) {
          return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid sub-role ID format: ${subRole.name || 'unknown'}`);
        }
      }
    }

    // Validate expiry date - should be at least one day from current time
    if (expiry) {
      const expiryDate = new Date(expiry);
      const currentDate = new Date();
      const oneDayFromNow = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      if (expiryDate < oneDayFromNow) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Expiry date must be at least one day from current time');
      }
    }

    const validEmployeeTypes = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'TEAMLEAD', 'EMPLOYEE'];
    if (!validEmployeeTypes.includes(employeeType.toUpperCase())) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid employee type. Must be ADMIN, SUPERVISOR, TEAMLEAD, or EMPLOYEE');
    }

    if (employeeType.toUpperCase() === 'ADMIN' && req.user.EmployeeType !== 'SUPERADMIN') {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'Only SuperAdmin can create Admin');
    }

    let assignedTeamLead = null;

    if (employeeType.toUpperCase() === 'EMPLOYEE') {
      const isSalesDepartment = department.toUpperCase() === 'SALES';

      const supervisorQuery = {
        EmployeeType: 'SUPERVISOR',
        'Department.name': department.toUpperCase(),
        isActive: true,
        tenantId: req.user.tenantId,
      };

      if (isSalesDepartment && zone) {
        supervisorQuery['zone.name'] = zone.toUpperCase();
      } else if (!isSalesDepartment && subRoles && subRoles.length > 0) {
        supervisorQuery['subRoles.refId'] = { $in: subRoles.map(sr => sr.refId) };
      }

      assignedSupervisor = await employeeSchema.findOne(supervisorQuery);

      const teamLeadQuery = {
        EmployeeType: 'TEAMLEAD',
        'Department.name': department.toUpperCase(),
        isActive: true,
        tenantId: req.user.tenantId,
      };

      if (isSalesDepartment && zone) {
        teamLeadQuery['zone.name'] = zone.toUpperCase();
      } else if (!isSalesDepartment && subRoles && subRoles.length > 0) {
        teamLeadQuery['subRoles.refId'] = { $in: subRoles.map(sr => sr.refId) };
      }

      assignedTeamLead = await employeeSchema.findOne(teamLeadQuery);
    }


    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedUsername = username?.trim();

    if (normalizedEmail || normalizedUsername) {
      const query = [];

      if (normalizedEmail) {
        query.push({ email: normalizedEmail });
      }

      if (normalizedUsername) {
        query.push({ username: normalizedUsername });
      }

      const existingDraft = await employeeDraftSchema.findOne({
        tenantId: req.user.tenantId,
        $or: query
      });

      if (existingDraft) {
        return sendErrorResponse(
          res,
          409,
          "DRAFT_EXISTS",
          "Draft employee with this email or username already exists"
        );
      }
    }


    const userData = {
      username: username && username.trim() ? username.trim() : undefined,
      employeeName,
      email: email && email.trim() ? email.toLowerCase().trim() : undefined,
      password,
      phone,
      address,
      country,
      pincode,
      aadharCard,
      panCard,
      expiry,
      EmployeeType: employeeType.toUpperCase(),
      createdBy: req.user.id,
      isActive: true,
      aadharCardImg,
      panCardImg,
      employeeProfileImg
    };

    if (employeeType.toUpperCase() !== 'SUPERADMIN') {
      if (department && departmentRefId) {
        userData.Department = {
          name: department.toUpperCase(),
          refId: departmentRefId
        };
      } else if (employeeType.toUpperCase() === 'ADMIN') {
        userData.Department = {
          name: 'ALL',
          refId: null
        };
      }
    }

    if (subRoles && subRoles.length > 0 && departmentRefId) {
      const deptDoc = await Department.findById(departmentRefId);
      userData.subRoles = subRoles.map(sr => {
        const match = deptDoc?.subRoles?.id(sr.refId);
        return {
          name: match?.name,
          refId: match?._id,
          code: match?.code,
          description: match?.description
        };
      });
    } else {
      userData.subRoles = subRoles || [];
    }

    // if (lab && labRefId) {
    //   userData.lab = {
    //     name: lab.toUpperCase(),
    //     refId: labRefId
    //   };
    // }

    if (zone && zoneRefId) {
      userData.zone = {
        name: zone.toUpperCase(),
        refId: zoneRefId
      };
    }

    if (employeeType.toUpperCase() === 'EMPLOYEE' && assignedSupervisor) {
      userData.supervisor = {
        name: assignedSupervisor.employeeName,
        refId: assignedSupervisor._id
      };

      if (assignedTeamLead) {
        userData.teamLead = {
          name: assignedTeamLead.employeeName,
          refId: assignedTeamLead._id
        };
      }
    }

    const newUser = new employeeDraftSchema(userData);
    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    return sendSuccessResponse(res, 201, { employee: userResponse }, `${employeeType.charAt(0).toUpperCase() + employeeType.slice(1).toLowerCase()} created successfully`);

  } catch (error) {
    console.error('Create employee error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create employee');
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const {
      department,
      EmployeeType,
      status = "active",
      fromDate,
      toDate,
      search,
      zone,
    } = req.query;

    const searchTerm = Array.isArray(search) ? search[0] : search;
    const departmentTerm = Array.isArray(department) ? department[0] : department;
    const employeeTypeTerm = Array.isArray(EmployeeType) ? EmployeeType[0] : EmployeeType;
    const statusTerm = Array.isArray(status) ? status[0] : status;

    let query = {};
    query.tenantId = req.user.tenantId;
    if (req.user.EmployeeType !== 'SUPERADMIN') {
      if (req.user.Department) {
        query['Department.name'] = req.user.Department;
      }
    } else if (departmentTerm) {
      query['Department.name'] = departmentTerm.toUpperCase();
    }

    if (employeeTypeTerm) {
      query.EmployeeType = employeeTypeTerm.toUpperCase();
    }

    if (searchTerm) {
      const searchConditions = [];

      if (!isNaN(searchTerm)) {
        searchConditions.push({ serialNumber: Number(searchTerm) });
      }

      searchConditions.push({ employeeName: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ employeeCode: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ username: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ phone: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ email: { $regex: searchTerm, $options: 'i' } });

      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchConditions.push({ 'zone.refId': new mongoose.Types.ObjectId(searchTerm) });
      }

      query.$or = searchConditions;
    }

    let startDate, endDate;
    if (fromDate) {
      startDate = new Date(fromDate);
      if (isNaN(startDate.valueOf())) {
        return sendErrorResponse(res, 400, 'INVALID_DATE', 'fromDate is not a valid date');
      }
      startDate.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      endDate = new Date(toDate);
      if (isNaN(endDate.valueOf())) {
        return sendErrorResponse(res, 400, 'INVALID_DATE', 'toDate is not a valid date');
      }
      endDate.setHours(23, 59, 59, 999);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    if (statusTerm) {
      if (statusTerm.toLowerCase() === 'active') {
        query.isActive = true;
      } else if (statusTerm.toLowerCase() === 'inactive') {
        query.isActive = false;
      }
    }

    if (zone && mongoose.Types.ObjectId.isValid(zone)) {
      query['zone.refId'] = zone;
    }

    console.log("query : ", query)

    const [users, total] = await Promise.all([
      employeeSchema
        .find(query)
        .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret -profile')
        .populate('createdBy supervisor', 'firstName lastName EmployeeType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      employeeSchema.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalUsers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { users, pagination }, 'Employees retrieved successfully');

  } catch (error) {
    console.error('Get employees error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employees');
  }
};

export const updateEmployeeDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    let updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return sendErrorResponse(res, 400, 'INVALID_PAYLOAD', 'Request body must be a JSON object containing fields to update');
    }

    updates = { ...updates };

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid user ID format');
    }

    delete updates.password;
    delete updates.EmployeeType;
    delete updates.createdBy;
    delete updates._id;

    if (updates.pageAccess !== undefined && !Array.isArray(updates.pageAccess)) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'pageAccess must be an array');
    }
    if (updates.accessPermissions !== undefined && !Array.isArray(updates.accessPermissions)) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'accessPermissions must be an array');
    }

    const validPageAccess = [
      "DASHBOARD", "REGISTER_CUSTOMER", "REGISTER_STAFF", "STAFF_LIST",
      "CUSTOMER_LIST", "SHIP_TO", "APPROVALS", "CORRECTIONS", "NEW_ORDER",
      "ALL_ORDERS", "PENDING_ORDERS", "OTHER_SALES", "SALES_LIST",
      "RETURN_REFUND", "EXCHANGE_REQUESTS", "DRAFTS", "DAILY_REPORT",
      "MAIN_REPORT", "ADD_REPAIR", "REPAIR_LIST", "ADD_VENDOR",
      "VENDOR_LIST", "VENDOR_ORDER", "QUALITY", "FITTING", "SHIPPING",
      "INVENTORY",
    ];
    const validAccessPermissions = [
      "ADD_STAFF", "UPDATE_STAFF", "DELETE_STAFF",
      "ADD_CUSTOMER", "UPDATE_CUSTOMER", "DELETE_CUSTOMER",
      "ADD_ORDER", "UPDATE_ORDER", "DELETE_ORDER", "APPROVE_ORDER",
      "ADD_DRAFT", "UPDATE_DRAFT", "DELETE_DRAFT",
      "ADD_REPAIR", "UPDATE_REPAIR", "DELETE_REPAIR",
      "ADD_VENDOR", "UPDATE_VENDOR", "DELETE_VENDOR",
      "UPDATE_QUALITY", "UPDATE_FITTING", "UPDATE_SHIPPING",
      "UPDATE_INVENTORY", "VIEW_REPORTS", "EXPORT_REPORTS",
    ];

    if (Array.isArray(updates.pageAccess)) {
      const invalid = updates.pageAccess.filter(p => !validPageAccess.includes(p));
      if (invalid.length > 0) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', `Invalid pageAccess values: ${invalid.join(', ')}`);
      }
    }

    if (Array.isArray(updates.accessPermissions)) {
      const invalid = updates.accessPermissions.filter(p => !validAccessPermissions.includes(p));
      if (invalid.length > 0) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', `Invalid accessPermissions values: ${invalid.join(', ')}`);
      }
    }

    delete updates.permissions;

    if (Object.keys(updates).length === 0) {
      return sendErrorResponse(res, 400, 'NO_UPDATES', 'No updatable fields supplied');
    }

    if (updates.expiry) {
      const expiryDate = new Date(updates.expiry);
      const currentDate = new Date();
      const oneDayFromNow = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      if (expiryDate < oneDayFromNow) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Expiry date must be at least one day from current time');
      }
    }
    let query = { _id: userId, isActive: true };

    if (req.user.EmployeeType === 'SUPERADMIN') {
    } else if (req.user.EmployeeType === 'ADMIN') {
      const targetUser = await employeeSchema.findById(userId);
      if (targetUser && targetUser.EmployeeType === 'SUPERADMIN') {
        return sendErrorResponse(res, 403, 'FORBIDDEN', 'Admin cannot update SuperAdmin');
      }
    } else if (req.user.EmployeeType === 'SUPERVISOR') {
      query['Department.name'] = req.user.Department;
      query['zone.name'] = req.user.zone?.name;
      query.EmployeeType = { $in: ['EMPLOYEE'] };
    } else {
      query._id = req.user.id;
    }

    const user = await employeeSchema.findOne(query);

    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Employee not found or not authorized to update');
    }

    const oldSupervisorId = user.supervisor?.refId?.toString();
    const oldTeamLeadId = user.teamLead?.refId?.toString();

    const newSupervisorId = updates.supervisor?.refId?.toString();
    const newTeamLeadId = updates.teamLead?.refId?.toString();

    const supervisorChanged = newSupervisorId && newSupervisorId !== oldSupervisorId;
    const teamLeadChanged = newTeamLeadId && newTeamLeadId !== oldTeamLeadId;

    if (supervisorChanged || teamLeadChanged) {
      await removeHierarchicalRelationships(userId, oldSupervisorId, oldTeamLeadId);
    }

    const permissionsDotNotation = updates.permissions;
    delete updates.permissions;

    Object.assign(user, updates);

    if (permissionsDotNotation) {
      await employeeSchema.findOneAndUpdate({ _id: userId, tenantId: req.user.tenantId }, { $set: permissionsDotNotation });
    }

    await user.save();

    if (supervisorChanged || teamLeadChanged) {
      await updateHierarchicalRelationships(
        userId,
        newSupervisorId || oldSupervisorId,
        newTeamLeadId || oldTeamLeadId
      );
    }

    const updatedUser = await employeeSchema.findOne({ _id: userId, tenantId: req.user.tenantId }).select('-password');
    return sendSuccessResponse(res, 200, { user: updatedUser }, 'Employee updated successfully');

  } catch (error) {
    console.error('Update employee error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update user');
  }
};

export const deactivateEmployee = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid user ID format');
    }

    const department = req.user.Department?.name || req.user.Department;
    const employeeType = req.user.EmployeeType;

    const targetUser = await employeeSchema.findOne({ _id: userId, tenantId: req.user.tenantId });

    if (!targetUser || !targetUser.isActive || targetUser.isDeleted) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Employee not found or already inactive');
    }

    if (employeeType === 'SUPERADMIN' && targetUser.EmployeeType === 'SUPERADMIN') {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'Cannot deactivate another SuperAdmin');
    }

    if (employeeType === 'ADMIN' && targetUser.EmployeeType === 'SUPERADMIN') {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'Admin cannot deactivate SuperAdmin');
    }

    if (employeeType !== 'SUPERADMIN' && employeeType !== 'ADMIN' && department !== "FINANCE") {
      return sendErrorResponse(res, 403, "FORBIDDEN', 'You don't have permission to deactivate employees");
    }

    const supervisorId = targetUser.supervisor?.refId?.toString();
    const teamLeadId = targetUser.teamLead?.refId?.toString();

    if (supervisorId || teamLeadId) {
      await removeHierarchicalRelationships(userId, supervisorId, teamLeadId);
    }

    if (targetUser.EmployeeType === 'TEAMLEAD' && supervisorId) {
      await employeeSchema.findByIdAndUpdate(
        supervisorId,
        { $pull: { teamLeadsUnderMe: userId } }
      );
    }

    if (targetUser.EmployeeType === 'SUPERVISOR' || targetUser.EmployeeType === 'TEAMLEAD') {
      if (targetUser.employeesUnderMe && targetUser.employeesUnderMe.length > 0) {
        await employeeSchema.updateMany(
          { _id: { $in: targetUser.employeesUnderMe } },
          {
            $unset: targetUser.EmployeeType === 'SUPERVISOR' ? { supervisor: "" } : { teamLead: "" }
          }
        );
      }

      if (targetUser.EmployeeType === 'SUPERVISOR' && targetUser.teamLeadsUnderMe && targetUser.teamLeadsUnderMe.length > 0) {
        await employeeSchema.updateMany(
          { _id: { $in: targetUser.teamLeadsUnderMe } },
          { $unset: { supervisor: "" } }
        );
      }
    }

    targetUser.isActive = false;
    targetUser.isDeleted = true;
    targetUser.deletedAt = new Date();
    targetUser.deletedBy = req.user.id;
    await targetUser.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Employee moved to recycle bin. Will be permanently deleted after 30 days');

  } catch (error) {
    console.error('Deactivate employee error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to deactivate employee');
  }
};

export const getEmployeeDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid user ID format');
    }

    let query = { _id: userId, isActive: true, tenantId: req.user.tenantId };

    const user = await employeeSchema.findOne(query)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret')
      .populate('createdBy supervisor', 'firstName lastName EmployeeType');

    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Employee not found');
    }

    return sendSuccessResponse(res, 200, { user }, 'Employee details retrieved successfully');

  } catch (error) {
    console.error('Get employee details error:', error);

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employee details');
  }
};

export const getAllDraftEmployee = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const {
      department,
      type,
      labs,
      status = "active",
      fromDate,
      toDate
    } = req.query;

    let query = {};
    query.tenantId = req.user.tenantId;

    if (department) {
      query['Department.name'] = department.toUpperCase();
    }

    if (type) {
      query.EmployeeType = type.toUpperCase();
    }

    if (labs) {
      query['lab.name'] = labs.toUpperCase();
    }

    // validate and apply draft date filters
    let draftStart, draftEnd;
    if (fromDate) {
      draftStart = new Date(fromDate);
      if (isNaN(draftStart.valueOf())) {
        return sendErrorResponse(res, 400, 'INVALID_DATE', 'fromDate is not a valid date');
      }
      draftStart.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      draftEnd = new Date(toDate);
      if (isNaN(draftEnd.valueOf())) {
        return sendErrorResponse(res, 400, 'INVALID_DATE', 'toDate is not a valid date');
      }
      draftEnd.setHours(23, 59, 59, 999);
    }
    if (draftStart || draftEnd) {
      query.createdAt = {};
      if (draftStart) query.createdAt.$gte = draftStart;
      if (draftEnd) query.createdAt.$lte = draftEnd;
    }


    if (status) {
      if (status.toLowerCase() === 'active') {
        query.isActive = true;
      } else if (status.toLowerCase() === 'inactive') {
        query.isActive = false;
      }
    }

    const [users, total] = await Promise.all([
      employeeDraftSchema
        .find(query)
        .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret -profile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      employeeDraftSchema.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalUsers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { users, pagination }, 'Employees retrieved successfully');

  } catch (error) {
    console.error('Get employees error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employees');
  }
};

export const getMyDraftEmployee = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    const query = { createdBy: userId, tenantId: req.user.tenantId };

    const [users, total] = await Promise.all([
      employeeDraftSchema
        .find(query)
        .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret -profile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      employeeDraftSchema.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalUsers: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { users, pagination }, 'Draft employees retrieved successfully');

  } catch (error) {
    console.error('Get draft employees error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve draft employees');
  }
};

export const getSupervisorsByDepartment = async (req, res) => {
  try {
    const { department, zone } = req.query;

    let query = {
      EmployeeType: 'SUPERVISOR',
      isActive: true,
      tenantId: req.user.tenantId,
    };
    if (req.user.EmployeeType === 'SUPERADMIN') {
      if (department) query['Department.name'] = department.toUpperCase();
      if (zone) query['zone.name'] = zone.toUpperCase();
    } else if (req.user.EmployeeType === 'ADMIN') {
      if (department) query['Department.name'] = department.toUpperCase();
      if (zone) query['zone.name'] = zone.toUpperCase();
    } else if (req.user.EmployeeType === 'SUPERVISOR') {
      query['Department.name'] = req.user.Department;
      query['zone.name'] = req.user.zone?.name;
    } else {
      query['Department.name'] = req.user.Department;
      query['zone.name'] = req.user.zone?.name;
    }

    const supervisors = await employeeSchema.find(query)
      .select('username employeeName email Department zone')
      .sort({ employeeName: 1 });

    return sendSuccessResponse(res, 200, { supervisors }, 'Supervisors retrieved successfully');

  } catch (error) {
    console.error('Get supervisors by department error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve supervisors');
  }
};


export const getDraftEmployeeDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid user ID format');
    }

    let query = { _id: userId, isActive: true, tenantId: req.user.tenantId };
    const user = await employeeDraftSchema.findOne(query)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret')

    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Employee not found');
    }

    return sendSuccessResponse(res, 200, { user }, 'Employee details retrieved successfully');

  } catch (error) {
    console.error('Get employee details error:', error);

    if (error.name === 'CastError') {
      return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid ${error.path} format. Please provide a valid MongoDB ObjectId`);
    }

    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employee details');
  }
};

export const restoreEmployee = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid user ID format');
    }

    const department = req.user.Department?.name || req.user.Department;
    const employeeType = req.user.EmployeeType;

    if (employeeType !== 'SUPERADMIN' && employeeType !== 'ADMIN' && department !== "FINANCE") {
      return sendErrorResponse(res, 403, "FORBIDDEN", "You don't have permission to restore employees");
    }

    const targetUser = await employeeSchema.findOne({ _id: userId, isDeleted: true, tenantId: req.user.tenantId });

    if (!targetUser) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Employee not found in recycle bin');
    }

    // Check if 30 days have passed
    const daysSinceDeletion = Math.floor((new Date() - new Date(targetUser.deletedAt)) / (1000 * 60 * 60 * 24));
    if (daysSinceDeletion > 30) {
      return sendErrorResponse(res, 400, 'EXPIRED', 'Cannot restore employee. More than 30 days have passed since deletion');
    }

    targetUser.isActive = true;
    targetUser.isDeleted = false;
    targetUser.deletedAt = null;
    targetUser.deletedBy = null;
    await targetUser.save({ validateBeforeSave: false });

    if (targetUser.EmployeeType === 'EMPLOYEE') {
      const supervisorId = targetUser.supervisor?.refId?.toString();
      const teamLeadId = targetUser.teamLead?.refId?.toString();

      if (supervisorId || teamLeadId) {
        await updateHierarchicalRelationships(userId, supervisorId, teamLeadId);
      }
    }

    if (targetUser.EmployeeType === 'TEAMLEAD') {
      const supervisorId = targetUser.supervisor?.refId?.toString();
      
      if (supervisorId) {
        await employeeSchema.findByIdAndUpdate(
          supervisorId,
          { $addToSet: { teamLeadsUnderMe: userId } }
        );
      }
    }

    return sendSuccessResponse(res, 200, null, 'Employee restored successfully');

  } catch (error) {
    console.error('Restore employee error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to restore employee');
  }
};

export const getDeletedEmployees = async (req, res) => {
  try {
    const department = req.user.Department?.name || req.user.Department;
    const employeeType = req.user.EmployeeType;

    if (employeeType !== 'SUPERADMIN' && employeeType !== 'ADMIN' && department !== "FINANCE") {
      return sendErrorResponse(res, 403, "FORBIDDEN", "You don't have permission to view deleted employees");
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const query = { isDeleted: true, tenantId: req.user.tenantId };

    const [deletedEmployees, total] = await Promise.all([
      employeeSchema.find(query)
        .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret')
        .populate('deletedBy', 'employeeName username')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      employeeSchema.countDocuments(query)
    ]);

    const employeesWithDaysLeft = deletedEmployees.map(emp => {
      const daysSinceDeletion = Math.floor((new Date() - new Date(emp.deletedAt)) / (1000 * 60 * 60 * 24));
      const daysLeft = 30 - daysSinceDeletion;

      return {
        ...emp,
        daysUntilPermanentDeletion: daysLeft > 0 ? daysLeft : 0,
        canRestore: daysLeft > 0
      };
    });

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalEmployees: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { employees: employeesWithDaysLeft, pagination }, 'Deleted employees retrieved successfully');

  } catch (error) {
    console.error('Get deleted employees error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deleted employees');
  }
};


export const getEmployeesUnderSupervisor = async (req, res) => {
  try {
    const { supervisorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid supervisor ID format');
    }

    const supervisor = await employeeSchema.findOne({
      _id: supervisorId,
      EmployeeType: 'SUPERVISOR',
      isActive: true,
      tenantId: req.user.tenantId,
    })
      .populate('teamLeadsUnderMe', 'employeeName username email phone EmployeeType Department zone')
      .populate('employeesUnderMe', 'employeeName username email phone EmployeeType Department zone supervisor teamLead');

    if (!supervisor) {
      return sendErrorResponse(res, 404, 'SUPERVISOR_NOT_FOUND', 'Supervisor not found');
    }

    const response = {
      supervisor: {
        _id: supervisor._id,
        employeeName: supervisor.employeeName,
        username: supervisor.username,
        email: supervisor.email
      },
      teamLeadsUnderMe: supervisor.teamLeadsUnderMe || [],
      employeesUnderMe: supervisor.employeesUnderMe || [],
      totalTeamLeads: supervisor.teamLeadsUnderMe?.length || 0,
      totalEmployees: supervisor.employeesUnderMe?.length || 0
    };

    return sendSuccessResponse(res, 200, response, 'Employees retrieved successfully');

  } catch (error) {
    console.error('Get employees under supervisor error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employees');
  }
};

export const getEmployeesUnderTeamLead = async (req, res) => {
  try {
    const { teamLeadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamLeadId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid team lead ID format');
    }

    const teamLead = await employeeSchema.findOne({
      _id: teamLeadId,
      EmployeeType: 'TEAMLEAD',
      isActive: true,
      tenantId: req.user.tenantId,
    })
      .populate('employeesUnderMe', 'employeeName username email phone EmployeeType Department zone supervisor teamLead');

    if (!teamLead) {
      return sendErrorResponse(res, 404, 'TEAMLEAD_NOT_FOUND', 'Team lead not found');
    }

    const response = {
      teamLead: {
        _id: teamLead._id,
        employeeName: teamLead.employeeName,
        username: teamLead.username,
        email: teamLead.email
      },
      employeesUnderMe: teamLead.employeesUnderMe || [],
      totalEmployees: teamLead.employeesUnderMe?.length || 0
    };

    return sendSuccessResponse(res, 200, response, 'Employees retrieved successfully');

  } catch (error) {
    console.error('Get employees under team lead error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employees');
  }
};

export const getMultipleEmployees = async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Employee IDs array is required');
    }

    for (const id of employeeIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendErrorResponse(res, 400, 'INVALID_ID', `Invalid employee ID format: ${id}`);
      }
    }

    const employees = await employeeSchema.find({
      _id: { $in: employeeIds },
      isActive: true,
      isDeleted: false,
      tenantId: req.user.tenantId
    })
    .select('employeeName _id EmployeeType email phone employeeProfileImg')
    .populate('EmployeeType', 'name');

    if (employees.length === 0) {
      return sendErrorResponse(res, 404, 'EMPLOYEES_NOT_FOUND', 'No active employees found with provided IDs');
    }

    const employeeData = employees.map(employee => ({
      id: employee._id,
      name: employee.employeeName,
      employeeType: employee.EmployeeType,
      email: employee.email,
      phone: employee.phone,
      image: employee.employeeProfileImg
    }));

    return sendSuccessResponse(res, 200, { employees: employeeData }, 'Employees retrieved successfully');

  } catch (error) {
    console.error('Get multiple employees error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve employees');
  }
};

export const getDepartmentHierarchy = async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid department ID format');
    }

    const supervisors = await employeeSchema.find({
      'Department.refId': departmentId,
      EmployeeType: 'SUPERVISOR',
      isActive: true,
      tenantId: req.user.tenantId,
    })
      .populate('teamLeadsUnderMe', 'employeeName username email EmployeeType')
      .populate('employeesUnderMe', 'employeeName username email EmployeeType')
      .select('employeeName username email EmployeeType Department zone teamLeadsUnderMe employeesUnderMe');

    const hierarchy = await Promise.all(supervisors.map(async (supervisor) => {
      const teamLeadsWithEmployees = await Promise.all(
        (supervisor.teamLeadsUnderMe || []).map(async (teamLead) => {
          const teamLeadFull = await employeeSchema.findById(teamLead._id)
            .populate('employeesUnderMe', 'employeeName username email EmployeeType');

          return {
            _id: teamLeadFull._id,
            employeeName: teamLeadFull.employeeName,
            username: teamLeadFull.username,
            email: teamLeadFull.email,
            employeesUnderMe: teamLeadFull.employeesUnderMe || []
          };
        })
      );

      return {
        supervisor: {
          _id: supervisor._id,
          employeeName: supervisor.employeeName,
          username: supervisor.username,
          email: supervisor.email,
          zone: supervisor.zone
        },
        teamLeadsUnderMe: teamLeadsWithEmployees,
        directEmployees: supervisor.employeesUnderMe || []
      };
    }));

    return sendSuccessResponse(res, 200, { hierarchy }, 'Department hierarchy retrieved successfully');

  } catch (error) {
    console.error('Get department hierarchy error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve department hierarchy');
  }
};
