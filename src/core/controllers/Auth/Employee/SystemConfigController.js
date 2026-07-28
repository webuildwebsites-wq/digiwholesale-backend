import SystemConfig from '../../../../models/Auth/SystemConfig.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../../Utils/response/responseHandler.js';

export const getConfigsByType = async (req, res) => {
  try {
    const { configType } = req.params;
    const config = await SystemConfig.findOne({ configType, tenantId: req.user.tenantId });
    if (!config) {
      return sendErrorResponse(res, 404, 'CONFIG_NOT_FOUND', 'Configuration not found');
    }
    return sendSuccessResponse(res, 200, config, 'Configurations retrieved successfully');
  } catch (error) {
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

export const getAllConfigs = async (req, res) => {
  try {
      const configs = await SystemConfig.find({ tenantId: req.user.tenantId }).lean();
    return sendSuccessResponse(res, 200, configs, 'All configurations retrieved successfully');
  } catch (error) {
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

export const createConfig = async (req, res) => {
  try {
    const { configType, value } = req.body;

    if (!configType || !value) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'ConfigType and value are required');
    }

    const formattedValue = value.trim().toUpperCase();

    let config = await SystemConfig.findOne({ configType, tenantId: req.user.tenantId });

    if (!config) {
      config = await SystemConfig.create({
        configType,
        values: [formattedValue],
        createdBy: req.user.id,
        tenantId: req.user.tenantId,
      });

      return sendSuccessResponse(res, 201, config, 'Configuration created successfully');
    }

    if (config.values.includes(formattedValue)) {
      return sendErrorResponse(res, 409, 'DUPLICATE_VALUE', 'Value already exists');
    }

    config.values.push(formattedValue);
    config.updatedBy = req.user.id;

    await config.save();

    return sendSuccessResponse(res, 200, config, 'Value added successfully');

  } catch (error) {
    console.error(error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

export const updateConfigValue = async (req, res) => {
  try {
    const { configType } = req.params;
    const { oldValue, newValue } = req.body;
    const config = await SystemConfig.findOne({ configType, tenantId: req.user.tenantId });

    if (!config) {
      return sendErrorResponse(res, 404, 'CONFIG_NOT_FOUND', 'Configuration not found');
    }

    const formattedOld = oldValue.trim().toUpperCase();
    const formattedNew = newValue.trim().toUpperCase();

    const index = config.values.indexOf(formattedOld);

    if (index === -1) {
      return sendErrorResponse(res, 404, 'VALUE_NOT_FOUND', 'Old value not found');
    }

    if (config.values.includes(formattedNew)) {
      return sendErrorResponse(res, 409, 'DUPLICATE_VALUE', 'New value already exists');
    }

    config.values[index] = formattedNew;
    config.updatedBy = req.employee._id;

    await config.save();

    return sendSuccessResponse(res, 200, config, 'Value updated successfully');

  } catch (error) {
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message);
  }
};

export const permanentDeleteConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const config = await SystemConfig.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });
    if (!config) {
      return sendErrorResponse(res, 404, 'CONFIG_NOT_FOUND', 'Configuration not found');
    }

    return sendSuccessResponse(res, 200, { id }, 'Configuration permanently deleted');
  } catch (error) {
    console.error('Permanent delete config error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', error.message || 'Failed to permanently delete configuration');
  }
};
