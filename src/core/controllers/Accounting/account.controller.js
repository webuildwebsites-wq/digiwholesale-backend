import mongoose from 'mongoose';
import Account from '../../../models/Accounting/Account.model.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';

const standardCOATemplates = [
  // --- ASSETS ---
  { accountCode: '1000', accountName: 'Assets', accountNature: 'Asset', accountType: 'General Ledger', isControlAccount: true, allowManualJournal: false, description: 'Master Assets Group' },
  { accountCode: '1100', accountName: 'Current Assets', accountNature: 'Asset', accountType: 'General Ledger', parentCode: '1000', isControlAccount: true, allowManualJournal: false, description: 'Current Assets' },
  { accountCode: '1110', accountName: 'Accounts Receivable (Trade Debtors)', accountNature: 'Asset', accountType: 'Customer', parentCode: '1100', isControlAccount: true, allowManualJournal: false, description: 'Control account for all customer balances' },
  { accountCode: '1120', accountName: 'Cash on Hand (Main Cash Counter)', accountNature: 'Asset', accountType: 'Cash', parentCode: '1100', isControlAccount: true, allowManualJournal: true, description: 'Physical cash register' },
  { accountCode: '1130', accountName: 'Primary Bank Account (Current A/C)', accountNature: 'Asset', accountType: 'Bank', parentCode: '1100', isControlAccount: true, allowManualJournal: true, description: 'Main operating bank account' },
  { accountCode: '1140', accountName: 'Advance Paid to Vendors', accountNature: 'Asset', accountType: 'Vendor', parentCode: '1100', isControlAccount: false, allowManualJournal: true, description: 'Advance payments made to vendors' },
  { accountCode: '1150', accountName: 'Inventory (Optical Lenses & Frames)', accountNature: 'Asset', accountType: 'Inventory', parentCode: '1100', isControlAccount: true, allowManualJournal: false, description: 'Wholesale inventory stock' },
  { accountCode: '1160', accountName: 'GST Input Tax Credit (ITC Receivable)', accountNature: 'Asset', accountType: 'Tax', parentCode: '1100', isControlAccount: false, allowManualJournal: true, description: 'CGST, SGST, IGST input tax credit' },

  // --- LIABILITIES ---
  { accountCode: '2000', accountName: 'Liabilities', accountNature: 'Liability', accountType: 'General Ledger', isControlAccount: true, allowManualJournal: false, description: 'Master Liabilities Group' },
  { accountCode: '2100', accountName: 'Current Liabilities', accountNature: 'Liability', accountType: 'General Ledger', parentCode: '2000', isControlAccount: true, allowManualJournal: false, description: 'Current Liabilities' },
  { accountCode: '2110', accountName: 'Accounts Payable (Trade Creditors)', accountNature: 'Liability', accountType: 'Vendor', parentCode: '2100', isControlAccount: true, allowManualJournal: false, description: 'Control account for all vendor balances' },
  { accountCode: '2120', accountName: 'Advance Received from Customers', accountNature: 'Liability', accountType: 'Customer', parentCode: '2100', isControlAccount: false, allowManualJournal: true, description: 'Advance received from customers' },
  { accountCode: '2130', accountName: 'TDS Payable (Tax Deducted at Source)', accountNature: 'Liability', accountType: 'Tax', parentCode: '2100', isControlAccount: false, allowManualJournal: true, description: 'TDS withheld on vendor payouts' },
  { accountCode: '2140', accountName: 'GST Output Tax Payable', accountNature: 'Liability', accountType: 'Tax', parentCode: '2100', isControlAccount: false, allowManualJournal: true, description: 'Output GST collected on sales' },

  // --- CAPITAL / EQUITY ---
  { accountCode: '3000', accountName: 'Capital & Equity', accountNature: 'Capital', accountType: 'General Ledger', isControlAccount: true, allowManualJournal: false, description: 'Master Capital Group' },
  { accountCode: '3100', accountName: 'Owner Equity / Share Capital', accountNature: 'Capital', accountType: 'General Ledger', parentCode: '3000', isControlAccount: false, allowManualJournal: true, description: 'Invested partner/owner capital' },

  // --- INCOME ---
  { accountCode: '4000', accountName: 'Income & Revenue', accountNature: 'Income', accountType: 'Income', isControlAccount: true, allowManualJournal: false, description: 'Master Income Group' },
  { accountCode: '4100', accountName: 'Wholesale Lens & Frame Sales Revenue', accountNature: 'Income', accountType: 'Income', parentCode: '4000', isControlAccount: true, allowManualJournal: false, description: 'Gross wholesale sales' },
  { accountCode: '4200', accountName: 'Fitting, Coating & Lab Service Charges', accountNature: 'Income', accountType: 'Income', parentCode: '4000', isControlAccount: false, allowManualJournal: true, description: 'Surfacing and coating service charges' },
  { accountCode: '4300', accountName: 'Cheque Bounce Penalty & Late Charges', accountNature: 'Income', accountType: 'Income', parentCode: '4000', isControlAccount: true, allowManualJournal: false, description: '₹500 cheque bounce penalty charges' },

  // --- EXPENSES ---
  { accountCode: '5000', accountName: 'Expenses', accountNature: 'Expense', accountType: 'Expense', isControlAccount: true, allowManualJournal: false, description: 'Master Expenses Group' },
  { accountCode: '5100', accountName: 'Cost of Goods Sold (Purchases)', accountNature: 'Expense', accountType: 'Expense', parentCode: '5000', isControlAccount: true, allowManualJournal: false, description: 'Lens & frame purchases from vendors' },
  { accountCode: '5200', accountName: 'Courier, Shipping & Dispatch Freight', accountNature: 'Expense', accountType: 'Expense', parentCode: '5000', isControlAccount: false, allowManualJournal: true, description: 'Logistics and delivery expenses' },
  { accountCode: '5300', accountName: 'Bank Charges & Processing Fees', accountNature: 'Expense', accountType: 'Expense', parentCode: '5000', isControlAccount: false, allowManualJournal: true, description: 'Bank charges and payment gateway fees' }
];

const ensureCOASeeded = async (tenantId = null) => {
  const query = tenantId 
    ? { $or: [{ tenantId }, { tenantId: null }, { tenantId: { $exists: false } }] }
    : {};
  
  const existingCount = await Account.countDocuments(query);
  if (existingCount === 0) {
    for (const item of standardCOATemplates) {
      await Account.create({
        accountCode: item.accountCode,
        accountName: item.accountName,
        accountNature: item.accountNature,
        accountType: item.accountType,
        isControlAccount: item.isControlAccount,
        allowManualJournal: item.allowManualJournal,
        description: item.description,
        tenantId: tenantId || null
      });
    }

    for (const item of standardCOATemplates) {
      if (item.parentCode) {
        const parent = await Account.findOne({ accountCode: item.parentCode, ...(tenantId ? { tenantId } : {}) });
        if (parent) {
          await Account.updateOne(
            { accountCode: item.accountCode, ...(tenantId ? { tenantId } : {}) },
            { $set: { parentAccount: parent._id } }
          );
        }
      }
    }
  }
};

/**
 * 1. Get Hierarchical Chart of Accounts Tree
 */
export const getAccountTree = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    await ensureCOASeeded(tenantId);

    const query = tenantId
      ? { $or: [{ tenantId }, { tenantId: null }, { tenantId: { $exists: false } }] }
      : {};

    const accounts = await Account.find(query)
      .sort({ accountCode: 1 })
      .populate('branchId', 'name')
      .lean();

    // Group accounts by nature
    const natures = ['Asset', 'Liability', 'Income', 'Expense', 'Capital'];
    const tree = {};

    natures.forEach(n => {
      tree[n] = [];
    });

    const accountMap = {};
    accounts.forEach(acc => {
      accountMap[acc._id.toString()] = { ...acc, children: [] };
    });

    accounts.forEach(acc => {
      const accId = acc._id.toString();
      if (acc.parentAccount && accountMap[acc.parentAccount.toString()]) {
        accountMap[acc.parentAccount.toString()].children.push(accountMap[accId]);
      } else {
        const nature = acc.accountNature || 'Asset';
        if (!tree[nature]) tree[nature] = [];
        tree[nature].push(accountMap[accId]);
      }
    });

    return sendSuccessResponse(res, 200, {
      tree,
      totalAccounts: accounts.length
    }, 'Chart of Accounts tree retrieved.');
  } catch (error) {
    console.error('getAccountTree error:', error);
    return sendErrorResponse(res, 500, 'GET_ACCOUNT_TREE_FAILED', error.message);
  }
};

/**
 * 2. Get Flat Accounts List
 */
export const getAccountsList = async (req, res) => {
  try {
    const { nature, type, status, search } = req.query;
    const tenantId = req.user?.tenantId || null;
    await ensureCOASeeded(tenantId);

    const query = tenantId
      ? { $or: [{ tenantId }, { tenantId: null }, { tenantId: { $exists: false } }] }
      : {};

    if (nature) query.accountNature = nature;
    if (type) query.accountType = type;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { accountCode: { $regex: search, $options: 'i' } },
        { accountName: { $regex: search, $options: 'i' } }
      ];
    }

    const accounts = await Account.find(query)
      .populate('parentAccount', 'accountCode accountName')
      .populate('branchId', 'name')
      .sort({ accountCode: 1 })
      .lean();

    return sendSuccessResponse(res, 200, accounts, 'Accounts list retrieved.');
  } catch (error) {
    return sendErrorResponse(res, 500, 'GET_ACCOUNTS_FAILED', error.message);
  }
};

/**
 * 3. Create Account
 */
export const createAccount = async (req, res) => {
  try {
    const {
      accountCode,
      accountName,
      accountNature,
      accountType,
      parentAccount,
      branchId,
      isControlAccount = false,
      allowManualJournal = false,
      gstApplicable = false,
      openingBalance = 0,
      description
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!accountCode || !accountName || !accountNature || !accountType) {
      return sendErrorResponse(res, 400, 'MISSING_FIELDS', 'Account code, name, nature, and type are required.');
    }

    const existing = await Account.findOne({ 
      accountCode: accountCode.trim().toUpperCase(),
      ...(tenantId ? { tenantId } : {})
    });

    if (existing) {
      return sendErrorResponse(res, 400, 'ACCOUNT_CODE_EXISTS', 'An account with this code already exists.');
    }

    const account = new Account({
      accountCode: accountCode.trim().toUpperCase(),
      accountName: accountName.trim(),
      accountNature,
      accountType,
      parentAccount: parentAccount || null,
      branchId: branchId || null,
      tenantId,
      isControlAccount: Boolean(isControlAccount),
      allowManualJournal: Boolean(allowManualJournal),
      gstApplicable: Boolean(gstApplicable),
      openingBalance: Number(openingBalance || 0),
      currentBalance: Number(openingBalance || 0),
      description,
      createdBy: userId
    });

    await account.save();

    return sendSuccessResponse(res, 201, account, 'Account created in Chart of Accounts.');
  } catch (error) {
    console.error('createAccount error:', error);
    return sendErrorResponse(res, 500, 'CREATE_ACCOUNT_FAILED', error.message);
  }
};

/**
 * 4. Update Account
 */
export const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      accountName,
      accountNature,
      accountType,
      parentAccount,
      branchId,
      allowManualJournal,
      gstApplicable,
      status,
      description
    } = req.body;

    const account = await Account.findById(id);
    if (!account) {
      return sendErrorResponse(res, 404, 'ACCOUNT_NOT_FOUND', 'Account not found.');
    }

    if (account.isControlAccount && status === 'Inactive') {
      return sendErrorResponse(res, 400, 'CONTROL_ACCOUNT_LOCKED', 'System Control accounts cannot be deactivated.');
    }

    if (accountName) account.accountName = accountName.trim();
    if (accountNature) account.accountNature = accountNature;
    if (accountType) account.accountType = accountType;
    if (parentAccount !== undefined) account.parentAccount = parentAccount || null;
    if (branchId !== undefined) account.branchId = branchId || null;
    if (allowManualJournal !== undefined) account.allowManualJournal = Boolean(allowManualJournal);
    if (gstApplicable !== undefined) account.gstApplicable = Boolean(gstApplicable);
    if (status) account.status = status;
    if (description !== undefined) account.description = description;

    await account.save();

    return sendSuccessResponse(res, 200, account, 'Account updated successfully.');
  } catch (error) {
    console.error('updateAccount error:', error);
    return sendErrorResponse(res, 500, 'UPDATE_ACCOUNT_FAILED', error.message);
  }
};
