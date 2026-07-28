import mongoose from "mongoose";
import { sendErrorResponse, sendSuccessResponse } from "../../../../Utils/response/responseHandler.js";
import Employee from "../../../../models/Auth/Employee.js";
import employeeDraftSchema from "../../../../models/Auth/EmployeeDraft.js";
import dotenv from "dotenv";
dotenv.config();

export const updateDraftEmployee = async (req, res) => {
  try {
    const { draftId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;
    const userEmployeeType = req.user?.EmployeeType;

    const draftEmployee = await employeeDraftSchema.findOne({ _id: draftId, tenantId: req.user.tenantId });

    if (!draftEmployee) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Draft employee not found');
    }

    const isCreator = draftEmployee.createdBy.toString() === userId?.toString();
    const isSuperAdmin = userEmployeeType === 'SUPERADMIN';
    
    if (!isCreator && !isSuperAdmin) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to update this draft');
    }

    // Check if email or username is being changed
    if (updateData.email || updateData.username) {
      const checkQuery = { _id: { $ne: draftId } };
      const orConditions = [];
      
      if (updateData.email && updateData.email.toLowerCase() !== draftEmployee.email) {
        orConditions.push({ email: updateData.email.toLowerCase() });
      }
      
      if (updateData.username && updateData.username !== draftEmployee.username) {
        orConditions.push({ username: updateData.username });
      }

      if (orConditions.length > 0) {
        checkQuery.$or = orConditions;
        
        const [existingEmployee, existingDraft] = await Promise.all([
          Employee.findOne({ ...checkQuery, tenantId: req.user.tenantId }),
          employeeDraftSchema.findOne({ ...checkQuery, tenantId: req.user.tenantId })
        ]);

        if (existingEmployee || existingDraft) {
          return sendErrorResponse(res, 409, 'DUPLICATE', 'Email or username already exists');
        }
      }
    }

    const updateFields = {};

    if (updateData.employeeName) updateFields.employeeName = updateData.employeeName.trim();
    if (updateData.username) updateFields.username = updateData.username.trim() || undefined;
    if (updateData.email) updateFields.email = updateData.email.trim() ? updateData.email.toLowerCase().trim() : undefined;
    if (updateData.password) updateFields.password = updateData.password;
    if (updateData.phone) updateFields.phone = updateData.phone;
    if (updateData.address) updateFields.address = updateData.address.trim();
    if (updateData.country) updateFields.country = updateData.country.trim();
    if (updateData.pincode) updateFields.pincode = updateData.pincode.trim();
    if (updateData.EmployeeType) updateFields.EmployeeType = updateData.EmployeeType;
    if (updateData.ProfilePicture !== undefined) updateFields.ProfilePicture = updateData.ProfilePicture;
    if (updateData.aadharCard) updateFields.aadharCard = updateData.aadharCard;
    if (updateData.panCard) updateFields.panCard = updateData.panCard;
    if (updateData.aadharCardImg) updateFields.aadharCardImg = updateData.aadharCardImg;
    if (updateData.panCardImg) updateFields.panCardImg = updateData.panCardImg;
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;

    if (updateData.expiry) {
      const expiryDate = new Date(updateData.expiry);
      const currentDate = new Date();
      const oneDayFromNow = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      if (expiryDate < oneDayFromNow) {
        return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Expiry date must be at least one day from current time');
      }
      updateFields.expiry = updateData.expiry;
    }

    if (updateData.Department && updateData.DepartmentRefId) {
      updateFields.Department = {
        name: updateData.Department,
        refId: updateData.DepartmentRefId
      };
    }

    if (updateData.subRoles && Array.isArray(updateData.subRoles)) {
      updateFields.subRoles = updateData.subRoles.map(role => ({
        name: role.name,
        refId: role.refId
      }));
    }

    // if (updateData.lab && updateData.labRefId) {
    //   updateFields.lab = {
    //     name: updateData.lab,
    //     refId: updateData.labRefId
    //   };
    // }

    if (updateData.zone && updateData.zoneRefId) {
      updateFields.zone = {
        name: updateData.zone,
        refId: updateData.zoneRefId
      };
    }

    if (updateData.supervisor && updateData.supervisorRefId) {
      updateFields.supervisor = {
        name: updateData.supervisor,
        refId: updateData.supervisorRefId
      };
    }

    if (updateData.teamLead && updateData.teamLeadRefId) {
      updateFields.teamLead = {
        name: updateData.teamLead,
        refId: updateData.teamLeadRefId
      };
    }

    if (updateData.dateOfJoining || updateData.dateOfBirth || updateData.emergencyContact) {
      updateFields.profile = {};
      if (updateData.dateOfJoining) updateFields['profile.dateOfJoining'] = updateData.dateOfJoining;
      if (updateData.dateOfBirth) updateFields['profile.dateOfBirth'] = updateData.dateOfBirth;
      if (updateData.emergencyContact) updateFields['profile.emergencyContact'] = updateData.emergencyContact;
    }

    const updatedDraft = await employeeDraftSchema.findOneAndUpdate(
      { _id: draftId, tenantId: req.user.tenantId },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    return sendSuccessResponse(res, 200, { employee: updatedDraft }, 'Draft employee updated successfully');

  } catch (error) {
    console.error('Update draft employee error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return sendErrorResponse(res, 409, 'DUPLICATE_FIELD', `${field} already exists`);
    }
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update draft employee');
  }
};

export const deactivateEmployeeDraft = async (req, res) => {
  try {
    const { draftId } = req.params;
    const userId = req.user.id;
    const userEmployeeType = req.user?.EmployeeType;
    const departmentName = req.user?.Department?.name || req.user?.Department;

    const draftEmployee = await employeeDraftSchema.findOne({ _id: draftId, tenantId: req.user.tenantId });

    if (!draftEmployee || !draftEmployee.isActive || draftEmployee.isDeleted) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Draft employee not found or already deactivated');
    }

    const isCreator = draftEmployee.createdBy.toString() === userId.toString();
    const isSuperAdmin = userEmployeeType === 'SUPERADMIN' || departmentName === 'FINANCE';
    
    if (!isCreator && !isSuperAdmin) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to deactivate this draft');
    }

    draftEmployee.isActive = false;
    draftEmployee.isDeleted = true;
    draftEmployee.deletedAt = new Date();
    draftEmployee.deletedBy = req.user.id;
    await draftEmployee.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Draft employee moved to recycle bin. Will be permanently deleted after 30 days');

  } catch (error) {
    console.error('Deactivate draft employee error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to deactivate draft employee');
  }
};  


export const restoreEmployeeDraft = async (req, res) => {
  try {
    const { draftId } = req.params;
    const userId = req.user.id;
    const userEmployeeType = req.user?.EmployeeType;
    const departmentName = req.user?.Department?.name || req.user?.Department;

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Invalid draft ID format');
    }

    const draftEmployee = await employeeDraftSchema.findOne({ _id: draftId, isDeleted: true, tenantId: req.user.tenantId });

    if (!draftEmployee) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Draft employee not found in recycle bin');
    }

    const isCreator = draftEmployee.createdBy.toString() === userId.toString();
    const isSuperAdmin = userEmployeeType === 'SUPERADMIN' || departmentName === 'FINANCE';
    
    if (!isCreator && !isSuperAdmin) {
      return sendErrorResponse(res, 403, 'FORBIDDEN', 'You do not have permission to restore this draft');
    }

    // Check if 30 days have passed
    const daysSinceDeletion = Math.floor((new Date() - new Date(draftEmployee.deletedAt)) / (1000 * 60 * 60 * 24));
    if (daysSinceDeletion > 30) {
      return sendErrorResponse(res, 400, 'EXPIRED', 'Cannot restore draft. More than 30 days have passed since deletion');
    }

    draftEmployee.isActive = true;
    draftEmployee.isDeleted = false;
    draftEmployee.deletedAt = null;
    draftEmployee.deletedBy = null;
    await draftEmployee.save({ validateBeforeSave: false });

    return sendSuccessResponse(res, 200, null, 'Draft employee restored successfully');

  } catch (error) {
    console.error('Restore draft employee error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to restore draft employee');
  }
};

export const getDeletedEmployeeDrafts = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmployeeType = req.user?.EmployeeType;
    const departmentName = req.user?.Department?.name || req.user?.Department;

    const isSuperAdmin = userEmployeeType === 'SUPERADMIN' || departmentName === 'FINANCE';
    
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    let query = { isDeleted: true, tenantId: req.user.tenantId };
    if (!isSuperAdmin) {
      query.createdBy = userId;
    }

    const [deletedDrafts, total] = await Promise.all([
      employeeDraftSchema.find(query)
        .populate('deletedBy', 'employeeName username')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      employeeDraftSchema.countDocuments(query)
    ]);

    const draftsWithDaysLeft = deletedDrafts.map(draft => {
      const daysSinceDeletion = Math.floor((new Date() - new Date(draft.deletedAt)) / (1000 * 60 * 60 * 24));
      const daysLeft = 30 - daysSinceDeletion;
      
      return {
        ...draft,
        daysUntilPermanentDeletion: daysLeft > 0 ? daysLeft : 0,
        canRestore: daysLeft > 0
      };
    });

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalDrafts: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return sendSuccessResponse(res, 200, { drafts: draftsWithDaysLeft, pagination }, 'Deleted draft employees retrieved successfully');

  } catch (error) {
    console.error('Get deleted draft employees error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve deleted draft employees');
  }
};
