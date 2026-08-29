import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Account from '../src/models/Accounting/Account.model.js';
import connectDB from '../src/core/config/DB/connectDb.js';

dotenv.config();

const standardCOA = [
  // --- ASSETS ---
  {
    accountCode: '1000',
    accountName: 'Assets',
    accountNature: 'Asset',
    accountType: 'General Ledger',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Master Assets Group'
  },
  {
    accountCode: '1100',
    accountName: 'Current Assets',
    accountNature: 'Asset',
    accountType: 'General Ledger',
    parentCode: '1000',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Current Assets'
  },
  {
    accountCode: '1110',
    accountName: 'Accounts Receivable (Trade Debtors)',
    accountNature: 'Asset',
    accountType: 'Customer',
    parentCode: '1100',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Control account for all customer balances'
  },
  {
    accountCode: '1120',
    accountName: 'Cash on Hand (Main Cash Counter)',
    accountNature: 'Asset',
    accountType: 'Cash',
    parentCode: '1100',
    isControlAccount: true,
    allowManualJournal: true,
    description: 'Cash counter physical cash register'
  },
  {
    accountCode: '1130',
    accountName: 'Primary Bank Account (Current A/C)',
    accountNature: 'Asset',
    accountType: 'Bank',
    parentCode: '1100',
    isControlAccount: true,
    allowManualJournal: true,
    description: 'Main operating current account for transfers/UPI/Cheques'
  },
  {
    accountCode: '1140',
    accountName: 'Advance Paid to Vendors',
    accountNature: 'Asset',
    accountType: 'Vendor',
    parentCode: '1100',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Advance payments made to vendors prior to invoice'
  },
  {
    accountCode: '1150',
    accountName: 'Inventory (Optical Lenses & Frames)',
    accountNature: 'Asset',
    accountType: 'Inventory',
    parentCode: '1100',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Total wholesale inventory on hand'
  },
  {
    accountCode: '1160',
    accountName: 'GST Input Tax Credit (ITC Receivable)',
    accountNature: 'Asset',
    accountType: 'Tax',
    parentCode: '1100',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'CGST, SGST, IGST input tax credit'
  },

  // --- LIABILITIES ---
  {
    accountCode: '2000',
    accountName: 'Liabilities',
    accountNature: 'Liability',
    accountType: 'General Ledger',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Master Liabilities Group'
  },
  {
    accountCode: '2100',
    accountName: 'Current Liabilities',
    accountNature: 'Liability',
    accountType: 'General Ledger',
    parentCode: '2000',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Current Liabilities'
  },
  {
    accountCode: '2110',
    accountName: 'Accounts Payable (Trade Creditors)',
    accountNature: 'Liability',
    accountType: 'Vendor',
    parentCode: '2100',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Control account for all vendor balances'
  },
  {
    accountCode: '2120',
    accountName: 'Advance Received from Customers',
    accountNature: 'Liability',
    accountType: 'Customer',
    parentCode: '2100',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Advance received from retail/wholesale customers'
  },
  {
    accountCode: '2130',
    accountName: 'TDS Payable (Tax Deducted at Source)',
    accountNature: 'Liability',
    accountType: 'Tax',
    parentCode: '2100',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'TDS deducted on vendor payouts to be remitted to government'
  },
  {
    accountCode: '2140',
    accountName: 'GST Output Tax Payable',
    accountNature: 'Liability',
    accountType: 'Tax',
    parentCode: '2100',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Output CGST, SGST, IGST collected on sales'
  },

  // --- CAPITAL / EQUITY ---
  {
    accountCode: '3000',
    accountName: 'Capital & Equity',
    accountNature: 'Capital',
    accountType: 'General Ledger',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Master Capital Group'
  },
  {
    accountCode: '3100',
    accountName: 'Owner Equity / Share Capital',
    accountNature: 'Capital',
    accountType: 'General Ledger',
    parentCode: '3000',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Partner/Owner invested capital'
  },

  // --- INCOME ---
  {
    accountCode: '4000',
    accountName: 'Income & Revenue',
    accountNature: 'Income',
    accountType: 'Income',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Master Income Group'
  },
  {
    accountCode: '4100',
    accountName: 'Wholesale Lens & Frame Sales Revenue',
    accountNature: 'Income',
    accountType: 'Income',
    parentCode: '4000',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Gross wholesale invoicing revenue'
  },
  {
    accountCode: '4200',
    accountName: 'Fitting, Coating & Lab Service Charges',
    accountNature: 'Income',
    accountType: 'Income',
    parentCode: '4000',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Value added surfacing, ARC and fitting service income'
  },
  {
    accountCode: '4300',
    accountName: 'Cheque Bounce Penalty & Late Charges',
    accountNature: 'Income',
    accountType: 'Income',
    parentCode: '4000',
    isControlAccount: true,
    allowManualJournal: false,
    description: '₹500 cheque bounce penalty and overdue charges recovered'
  },

  // --- EXPENSES ---
  {
    accountCode: '5000',
    accountName: 'Expenses',
    accountNature: 'Expense',
    accountType: 'Expense',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Master Expenses Group'
  },
  {
    accountCode: '5100',
    accountName: 'Cost of Goods Sold (Purchases & Consumables)',
    accountNature: 'Expense',
    accountType: 'Expense',
    parentCode: '5000',
    isControlAccount: true,
    allowManualJournal: false,
    description: 'Raw materials, lenses, frames purchased from vendors'
  },
  {
    accountCode: '5200',
    accountName: 'Courier, Shipping & Dispatch Freight',
    accountNature: 'Expense',
    accountType: 'Expense',
    parentCode: '5000',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Logistics and delivery expenses'
  },
  {
    accountCode: '5300',
    accountName: 'Bank Charges & Payment Processing Fees',
    accountNature: 'Expense',
    accountType: 'Expense',
    parentCode: '5000',
    isControlAccount: false,
    allowManualJournal: true,
    description: 'Bank processing and payment charges'
  }
];

const seedAccounts = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB for Chart of Accounts Seeding...");

    // First pass: create parent accounts
    for (const item of standardCOA) {
      const existing = await Account.findOne({ accountCode: item.accountCode });
      if (!existing) {
        await Account.create({
          accountCode: item.accountCode,
          accountName: item.accountName,
          accountNature: item.accountNature,
          accountType: item.accountType,
          isControlAccount: item.isControlAccount || false,
          allowManualJournal: item.allowManualJournal !== undefined ? item.allowManualJournal : true,
          description: item.description
        });
        console.log(`Created Account: [${item.accountCode}] ${item.accountName}`);
      } else {
        console.log(`Account [${item.accountCode}] already exists, skipping.`);
      }
    }

    // Second pass: link parentAccount ObjectIds
    for (const item of standardCOA) {
      if (item.parentCode) {
        const parent = await Account.findOne({ accountCode: item.parentCode });
        if (parent) {
          await Account.updateOne(
            { accountCode: item.accountCode },
            { $set: { parentAccount: parent._id } }
          );
        }
      }
    }

    console.log("Chart of Accounts seeded and linked successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedAccounts();
