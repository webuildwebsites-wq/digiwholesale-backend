import dotenv from 'dotenv';
dotenv.config();

export const sendSuccessResponse = (res, statusCode = 200, data = null, message = null) => {
  const response = {
    success: true,
    ...(message && { message }),
    ...(data && { data })
  };
  
  return res.status(statusCode).json(response);
};

export const sendErrorResponse = (res, statusCode = 500, code = 'INTERNAL_ERROR', message = 'Internal server error', timestamp = new Date().toISOString(), meta = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
      timestamp,
      ...(meta && { meta }),
    }
  };
  
  return res.status(statusCode).json(response);
};

export const sendTokenResponse = (user, statusCode, res, AccountType = 'EMPLOYEE', generateToken, generateRefreshToken, tenant = null) => {
  const EmployeeType = AccountType === 'CUSTOMER' 
    ? 'CUSTOMER' 
    : (user.EmployeeType?.name || user.EmployeeType);
  const token = generateToken(user._id, EmployeeType, AccountType);
  const refreshToken = generateRefreshToken(user._id, EmployeeType, AccountType);

  const options = {
    expires: new Date(Date.now() + parseFloat(process.env.JWT_COOKIE_EXPIRE || 24) * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  const userObj = user.toObject();
  delete userObj.password;

  const tenantData = tenant
    ? {
        _id: tenant._id,
        tenantId: tenant.tenantId,
        storeInformation: tenant.storeInformation,
        status: tenant.status,
        subscription: tenant.subscription,
        loyalty: tenant.loyalty,
        whatsappConfig: tenant.whatsappConfig,
      }
    : null;

  return res
    .status(statusCode)
    .cookie('token', token, options)
    .cookie('refreshToken', refreshToken, {
      ...options,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    })
    .json({
      success: true,
      data: {
        user: {
          ...userObj,
          EmployeeType,
          AccountType
        },
        tenant: tenantData,
        tokens: {
          accessToken: token,
          refreshToken: refreshToken,
          expiresIn: 24 * 60 * 60 
        }
      }
    });
};

export const sendLogoutResponse = (res) => {
  return res
    .status(200)
    .cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    })
    .cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    })
    .json({
      success: true,
      message: 'Logged out successfully'
    });
};