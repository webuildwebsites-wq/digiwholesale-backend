import mongoose from 'mongoose';
import CustomerLedger from '../../../models/Accounting/CustomerLedger.model.js';
import VendorLedger from '../../../models/Accounting/VendorLedger.model.js';
import BulkOrder from '../../../models/order/BulkOrder.js';
import VendorPurchase from '../../../models/Purchase/VendorPurchase.model.js';
import Customer from '../../../models/Auth/Customer.js';
import Vendor from '../../../models/Vendor.model.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';

export const getAgingReport = async (req, res) => {
  try {
    const { entityType = 'Customer', branchId } = req.query;
    const tenantId = req.user?.tenantId || null;
    const now = new Date();

    const tenantFilter = tenantId 
      ? { $or: [{ tenantId }, { tenantId: null }, { tenantId: { $exists: false } }] } 
      : {};

    if (entityType === 'Customer' || entityType === 'Receivables') {
      const customers = await Customer.find(tenantFilter).lean();

      let grandTotal = 0;
      let total0_30 = 0;
      let total31_60 = 0;
      let total61_90 = 0;
      let total90Plus = 0;

      const partyAging = [];

      for (const cust of customers) {
        let ledger = await CustomerLedger.findOne({ customerId: cust._id }).lean();
        
        let balance = Number(ledger?.currentBalance || 0);

        // Fetch customer orders
        const orders = await BulkOrder.find({
          'customer.customerId': cust._id
        }).sort({ createdAt: -1 }).limit(20).lean();

        if (balance === 0 && orders.length > 0) {
          orders.forEach(ord => {
            if (ord.orders && Array.isArray(ord.orders)) {
              const ordSum = ord.orders.reduce((sum, o) => sum + (Number(o.totalOrderPrice) || 0), 0);
              balance += Math.max(0, ordSum - Number(ord.advanceAmount || 0));
            }
          });
        }

        if (balance <= 0) continue;

        grandTotal += balance;

        let bucket0_30 = 0;
        let bucket31_60 = 0;
        let bucket61_90 = 0;
        let bucket90Plus = 0;

        let unallocatedBalance = balance;

        for (const ord of orders) {
          if (unallocatedBalance <= 0) break;

          const ordDate = new Date(ord.createdAt);
          const diffDays = Math.floor((now - ordDate) / (1000 * 60 * 60 * 24));
          
          let ordTotal = 0;
          if (ord.orders && Array.isArray(ord.orders)) {
            ordTotal = ord.orders.reduce((sum, o) => sum + (Number(o.totalOrderPrice) || 0), 0);
          }
          const netOrdUnpaid = Math.min(unallocatedBalance, ordTotal > 0 ? ordTotal : unallocatedBalance);

          if (diffDays <= 30) {
            bucket0_30 += netOrdUnpaid;
          } else if (diffDays <= 60) {
            bucket31_60 += netOrdUnpaid;
          } else if (diffDays <= 90) {
            bucket61_90 += netOrdUnpaid;
          } else {
            bucket90Plus += netOrdUnpaid;
          }

          unallocatedBalance -= netOrdUnpaid;
        }

        if (unallocatedBalance > 0) {
          bucket90Plus += unallocatedBalance;
        }

        total0_30 += bucket0_30;
        total31_60 += bucket31_60;
        total61_90 += bucket61_90;
        total90Plus += bucket90Plus;

        partyAging.push({
          partyId: cust._id,
          partyName: cust.shopName || cust.ownerName || 'Customer',
          ownerName: cust.ownerName,
          mobile: cust.mobile,
          ledgerCode: ledger?.ledgerCode || `CUST-LED-${cust._id.toString().slice(-6).toUpperCase()}`,
          creditLimit: ledger?.creditLimit || 0,
          creditDays: ledger?.creditDays || 30,
          currentBalance: balance,
          bucket0_30,
          bucket31_60,
          bucket61_90,
          bucket90Plus,
          overdueAmount: ledger?.overdueAmount || 0,
          status: ledger?.ledgerStatus || 'Active'
        });
      }

      return sendSuccessResponse(res, 200, {
        reportType: 'Accounts Receivable Aging',
        asOfDate: now.toISOString(),
        summary: {
          totalOutstanding: grandTotal,
          total0_30,
          total31_60,
          total61_90,
          total90Plus,
          partyCount: partyAging.length
        },
        parties: partyAging
      }, 'Customer Aging Report generated.');
    }

    if (entityType === 'Vendor' || entityType === 'Payables') {
      const vendors = await Vendor.find(tenantFilter).lean();

      let grandTotal = 0;
      let total0_30 = 0;
      let total31_60 = 0;
      let total61_90 = 0;
      let total90Plus = 0;

      const partyAging = [];

      for (const v of vendors) {
        let ledger = await VendorLedger.findOne({ vendorId: v._id }).lean();
        let balance = Number(ledger?.currentOutstanding || 0);

        const purchases = await VendorPurchase.find({
          'vendor.vendorId': v._id
        }).sort({ createdAt: -1 }).limit(20).lean();

        if (balance === 0 && purchases.length > 0) {
          purchases.forEach(pur => {
            if (pur.orders && Array.isArray(pur.orders)) {
              balance += pur.orders.reduce((sum, o) => sum + (Number(o.totalOrderPrice) || 0), 0);
            }
          });
        }

        if (balance <= 0) continue;

        grandTotal += balance;

        let bucket0_30 = 0;
        let bucket31_60 = 0;
        let bucket61_90 = 0;
        let bucket90Plus = 0;

        let unallocatedBalance = balance;

        for (const pur of purchases) {
          if (unallocatedBalance <= 0) break;

          const purDate = new Date(pur.createdAt);
          const diffDays = Math.floor((now - purDate) / (1000 * 60 * 60 * 24));

          let purTotal = 0;
          if (pur.orders && Array.isArray(pur.orders)) {
            purTotal = pur.orders.reduce((sum, o) => sum + (Number(o.totalOrderPrice) || 0), 0);
          }
          const netPurUnpaid = Math.min(unallocatedBalance, purTotal > 0 ? purTotal : unallocatedBalance);

          if (diffDays <= 30) {
            bucket0_30 += netPurUnpaid;
          } else if (diffDays <= 60) {
            bucket31_60 += netPurUnpaid;
          } else if (diffDays <= 90) {
            bucket61_90 += netPurUnpaid;
          } else {
            bucket90Plus += netPurUnpaid;
          }

          unallocatedBalance -= netPurUnpaid;
        }

        if (unallocatedBalance > 0) {
          bucket90Plus += unallocatedBalance;
        }

        total0_30 += bucket0_30;
        total31_60 += bucket31_60;
        total61_90 += bucket61_90;
        total90Plus += bucket90Plus;

        partyAging.push({
          partyId: v._id,
          partyName: v.firm || v.name || 'Vendor',
          contactPerson: v.name,
          mobile: v.mobile,
          ledgerCode: ledger?.ledgerCode || `VEND-LED-${v._id.toString().slice(-6).toUpperCase()}`,
          vendorCategory: ledger?.vendorCategory || 'Manufacturer',
          paymentTerms: ledger?.paymentTerms || 30,
          currentOutstanding: balance,
          bucket0_30,
          bucket31_60,
          bucket61_90,
          bucket90Plus,
          overdueAmount: ledger?.overdueAmount || 0,
          status: ledger?.ledgerStatus || 'Active'
        });
      }

      return sendSuccessResponse(res, 200, {
        reportType: 'Accounts Payable Aging',
        asOfDate: now.toISOString(),
        summary: {
          totalOutstanding: grandTotal,
          total0_30,
          total31_60,
          total61_90,
          total90Plus,
          partyCount: partyAging.length
        },
        parties: partyAging
      }, 'Vendor Aging Report generated.');
    }

    return sendErrorResponse(res, 400, 'INVALID_ENTITY_TYPE', 'entityType must be Customer or Vendor.');
  } catch (error) {
    console.error('getAgingReport error:', error);
    return sendErrorResponse(res, 500, 'AGING_REPORT_FAILED', error.message);
  }
};
