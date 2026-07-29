import { sendSuccessResponse, sendErrorResponse, sendTokenResponse } from '../../../../Utils/response/responseHandler.js';
import { generateToken, generateRefreshToken } from '../../../../Utils/Auth/tokenUtils.js';
import employeeSchema from '../../../../models/Auth/Employee.js';
import Tenant from '../../../../models/Tenant/Tenant.model.js';
import { sendEmail } from '../../../../core/config/Email/emailService.js';
import ResetPasswordTemplate from '../../../../Utils/Mail/ResetPasswordTemplate.js';
import { generateResetToken, verifyResetToken, decodeUidb36 } from '../../../../Utils/Auth/passwordResetUtils.js';
import dotenv from 'dotenv';
dotenv.config();

export const employeeLogin = async (req, res) => {
  try {
    const { loginId, password, tenantId } = req.body;
    if (!loginId || !password) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Please provide login ID (username, email, or employee code) and password');
    }

    const query = {
      $or: [
        { username: loginId },
        { email: loginId.toLowerCase() },
        { employeeCode: loginId.toUpperCase() }
      ],
      isActive: true,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const user = await employeeSchema.findOne(query)
    .select('+password')
    .populate('EmployeeType', 'name')
    .populate('createdBy supervisor', 'username employeeName email');

    if (!user) {
      return sendErrorResponse(res, 422, 'INVALID_CREDENTIALS', 'Invalid credentials or account is inactive');
    }

    if (!user.tenantId && user.EmployeeType !== 'PLATFORM_OWNER') {
      return sendErrorResponse(res, 403, 'NO_TENANT', 'Account is not associated with any workspace. Please contact support.');
    }

    let tenant = null;
    if (user.tenantId) {
      tenant = await Tenant.findOne({ tenantId: user.tenantId }).lean();
      if (!tenant || tenant.status === 'SUSPENDED') {
        return sendErrorResponse(res, 403, 'TENANT_SUSPENDED', 'Your workspace has been suspended. Please contact support.');
      }
    }

    if (user.isLocked) {
      return sendErrorResponse(res, 423, 'ACCOUNT_LOCKED', 'Account is temporarily locked due to too many failed login attempts');
    }

    if(user.expiry && user.expiry < new Date()) {
      return sendErrorResponse(res, 403, 'ACCOUNT_EXPIRED', 'Account has expired. Please contact administrator.');
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return sendErrorResponse(res, 422, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    return sendTokenResponse(user, 200, res, 'EMPLOYEE', generateToken, generateRefreshToken, tenant);

  } catch (error) {
    console.error('Employee login error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Internal server error during login');
  }
};

export const employeeForgotPassword = async (req, res) => {
  try {
    const { email, tenantId } = req.body;

    if (!email) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Please provide email address');
    }

    const query = { email: email.toLowerCase(), isActive: true };
    if (tenantId) query.tenantId = tenantId;

    const user = await employeeSchema.findOne(query).select('+password');

    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'No active account found with that email address');
    }

    const { uidb36, token } = generateResetToken(user._id, user.password);

    const frontendUrl = process.env.FRONTEND_URL;
    const resetUrl = `${frontendUrl}/reset-password/confirm?uidb36=${uidb36}&token=${encodeURIComponent(token)}&type=employee`;

    const emailResult = await sendEmail({
      to: user.email,
      subject: 'DigiWholesale — Password Reset Request',
      html: ResetPasswordTemplate(user.employeeName, resetUrl, 30),
    });

    if (!emailResult.success) {
      return sendErrorResponse(res, 500, 'EMAIL_FAILED', 'Email could not be sent. Please try again.');
    }

    return sendSuccessResponse(res, 200, { message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Employee forgot password error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Email could not be sent');
  }
};

export const employeeResetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { uidb36, token } = req.query;

    if (!uidb36 || !token) {
      return sendErrorResponse(res, 400, 'INVALID_TOKEN', 'Invalid reset link');
    }

    if (!password || !confirmPassword) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Please provide new password and confirm password');
    }

    if (password !== confirmPassword) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Passwords do not match');
    }

    if (password.length < 8) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    let userId;
    try {
      userId = decodeUidb36(uidb36);
    } catch {
      return sendErrorResponse(res, 400, 'INVALID_TOKEN', 'Invalid reset link');
    }

    const user = await employeeSchema.findById(userId).select('+password');

    if (!user || !user.isActive) {
      return sendErrorResponse(res, 400, 'INVALID_TOKEN', 'Invalid reset link');
    }

    const { valid, expired } = verifyResetToken(uidb36, token, user.password);

    if (expired) {
      return sendErrorResponse(res, 400, 'TOKEN_EXPIRED', 'Reset link has expired. Please request a new one.');
    }

    if (!valid) {
      return sendErrorResponse(res, 400, 'INVALID_TOKEN', 'Invalid reset link');
    }

    user.password = password;
    user.lockUntil = undefined;
    user.failedLoginAttempts = 0;

    await user.save({ validateBeforeSave: false });
    // await user.save();

    return sendSuccessResponse(res, 200, { message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Employee reset password error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Password could not be reset');
  }
};

export const getEmployeeProfile = async (req, res) => {
  try {
    const user = await employeeSchema.findById(req.user.id);

    if (!user) {
      return sendErrorResponse(res, 404, 'USER_NOT_FOUND', 'Employee not found');
    }

    const userData = {
      user: {
        ...user.toObject(),
        EmployeeType: req.user.EmployeeType,
        AccountType: req.user.AccountType
      }
    };

    return sendSuccessResponse(res, 200, userData);
  } catch (error) {
    console.error('Get user profile error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
};