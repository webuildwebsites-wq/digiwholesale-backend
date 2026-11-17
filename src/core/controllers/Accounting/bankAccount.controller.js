import BankAccount from '../../../models/Accounting/BankAccount.model.js';
import Payment from '../../../models/Accounting/Payment.model.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';

/**
 * Create a new Company Bank Account
 */
export const createBankAccount = async (req, res) => {
  try {
    const {
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName = '',
      accountType = 'Current',
      upiId = '',
      isDefault = false,
      isActive = true,
      description = '',
    } = req.body;

    const tenantId = req.user?.tenantId;
    const userId = req.user?.id || req.user?._id;

    if (!tenantId) {
      return sendErrorResponse(res, 400, 'NO_TENANT', 'User is not associated with a tenant');
    }

    if (!bankName || !bankName.trim()) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Bank name is required');
    }
    if (!accountHolderName || !accountHolderName.trim()) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Account holder name is required');
    }
    if (!accountNumber || !accountNumber.trim()) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Account number is required');
    }
    if (!ifscCode || !ifscCode.trim()) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'IFSC code is required');
    }

    // Check duplicate account number within this tenant
    const existing = await BankAccount.findOne({
      accountNumber: accountNumber.trim(),
      tenantId,
    });
    if (existing) {
      return sendErrorResponse(
        res,
        409,
        'DUPLICATE_ERROR',
        `Bank account with number ending in ${accountNumber.trim().slice(-4)} already exists`
      );
    }

    // If marked as default, unset other defaults
    if (isDefault) {
      await BankAccount.updateMany(
        { tenantId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const bankAccount = await BankAccount.create({
      bankName: bankName.trim(),
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      branchName: branchName ? branchName.trim() : '',
      accountType: accountType || 'Current',
      upiId: upiId ? upiId.trim() : '',
      isDefault: Boolean(isDefault),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      description: description ? description.trim() : '',
      createdBy: userId,
      tenantId,
    });

    return sendSuccessResponse(res, 201, bankAccount, 'Bank account added successfully');
  } catch (error) {
    console.error('createBankAccount error:', error);
    return sendErrorResponse(res, 500, 'CREATE_BANK_ACCOUNT_FAILED', error.message);
  }
};

/**
 * Get all Bank Accounts for the tenant
 */
export const getAllBankAccounts = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return sendErrorResponse(res, 400, 'NO_TENANT', 'User is not associated with a tenant');
    }

    const { isActive, search } = req.query;
    const filter = { tenantId };

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { bankName: regex },
        { accountHolderName: regex },
        { accountNumber: regex },
        { ifscCode: regex },
        { branchName: regex },
        { upiId: regex },
      ];
    }

    const accounts = await BankAccount.find(filter)
      .sort({ isDefault: -1, createdAt: -1 })
      .lean({ virtuals: true });

    return sendSuccessResponse(res, 200, accounts, 'Bank accounts retrieved successfully');
  } catch (error) {
    console.error('getAllBankAccounts error:', error);
    return sendErrorResponse(res, 500, 'GET_BANK_ACCOUNTS_FAILED', error.message);
  }
};

/**
 * Get single Bank Account by ID
 */
export const getBankAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    const account = await BankAccount.findOne({ _id: id, tenantId }).lean({ virtuals: true });
    if (!account) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Bank account not found');
    }

    return sendSuccessResponse(res, 200, account, 'Bank account retrieved successfully');
  } catch (error) {
    console.error('getBankAccountById error:', error);
    return sendErrorResponse(res, 500, 'GET_BANK_ACCOUNT_FAILED', error.message);
  }
};

/**
 * Update Bank Account
 */
export const updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    const account = await BankAccount.findOne({ _id: id, tenantId });
    if (!account) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Bank account not found');
    }

    const {
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName,
      accountType,
      upiId,
      isDefault,
      isActive,
      description,
    } = req.body;

    if (accountNumber && accountNumber.trim() !== account.accountNumber) {
      const existing = await BankAccount.findOne({
        accountNumber: accountNumber.trim(),
        tenantId,
        _id: { $ne: id },
      });
      if (existing) {
        return sendErrorResponse(
          res,
          409,
          'DUPLICATE_ERROR',
          `Bank account with number ending in ${accountNumber.trim().slice(-4)} already exists`
        );
      }
      account.accountNumber = accountNumber.trim();
    }

    if (bankName !== undefined) account.bankName = bankName.trim();
    if (accountHolderName !== undefined) account.accountHolderName = accountHolderName.trim();
    if (ifscCode !== undefined) account.ifscCode = ifscCode.trim().toUpperCase();
    if (branchName !== undefined) account.branchName = branchName.trim();
    if (accountType !== undefined) account.accountType = accountType;
    if (upiId !== undefined) account.upiId = upiId.trim();
    if (description !== undefined) account.description = description.trim();

    if (isDefault !== undefined) {
      const willBeDefault = Boolean(isDefault);
      if (willBeDefault && !account.isDefault) {
        await BankAccount.updateMany(
          { tenantId, _id: { $ne: id }, isDefault: true },
          { $set: { isDefault: false } }
        );
      }
      account.isDefault = willBeDefault;
    }

    if (isActive !== undefined) {
      account.isActive = Boolean(isActive);
    }

    await account.save();

    return sendSuccessResponse(res, 200, account, 'Bank account updated successfully');
  } catch (error) {
    console.error('updateBankAccount error:', error);
    return sendErrorResponse(res, 500, 'UPDATE_BANK_ACCOUNT_FAILED', error.message);
  }
};

/**
 * Delete Bank Account
 */
export const deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    const account = await BankAccount.findOne({ _id: id, tenantId });
    if (!account) {
      return sendErrorResponse(res, 404, 'NOT_FOUND', 'Bank account not found');
    }

    // Check if this bank account is linked to any payments
    const paymentsCount = await Payment.countDocuments({
      'paymentDetails.bankAccountId': id,
      tenantId,
    });

    if (paymentsCount > 0) {
      // Deactivate instead of deleting to protect audit history
      account.isActive = false;
      await account.save();
      return sendSuccessResponse(
        res,
        200,
        account,
        `Bank account has ${paymentsCount} associated payments. It was set to Inactive instead of permanently deleted to preserve financial audit records.`
      );
    }

    await BankAccount.findByIdAndDelete(id);

    return sendSuccessResponse(res, 200, null, 'Bank account deleted successfully');
  } catch (error) {
    console.error('deleteBankAccount error:', error);
    return sendErrorResponse(res, 500, 'DELETE_BANK_ACCOUNT_FAILED', error.message);
  }
};

