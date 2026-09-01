import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Customer from '../src/models/Auth/Customer.js';
import CustomerLedger from '../src/models/Accounting/CustomerLedger.model.js';
import LedgerTransaction from '../src/models/Accounting/LedgerTransaction.model.js';
import BulkOrder from '../src/models/order/BulkOrder.js';

const EXCLUDED_STATUSES = ['Draft', 'Cancelled'];

const deriveGrandTotal = (orders, shippingCharges, otherCharges) => {
  let total = 0;
  for (const ord of orders) {
    if (ord.grossTotalWithCharges && Number(ord.grossTotalWithCharges) > 0) {
      total += Number(ord.grossTotalWithCharges);
    } else if (ord.totalOrderPrice && Number(ord.totalOrderPrice) > 0) {
      total += Number(ord.totalOrderPrice);
    } else if (Array.isArray(ord.items)) {
      for (const it of ord.items) {
        const price   = Number(it.price || 0);
        const qty     = Number(it.qty   || 1);
        const disc    = Number(it.discountAmount || 0);
        const taxable = Math.max(0, price * qty - disc);
        const gst     = Number(it.gst || 0);
        total += taxable + taxable * (gst / 100);
      }
    }
  }
  total += Number(shippingCharges || 0) + Number(otherCharges || 0);
  return total;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to MongoDB\n');

  // Resolve the system admin user to satisfy createdBy required field
  const Employee = (await import('../src/models/Auth/Employee.js')).default;
  const systemUser = await Employee.findOne({ EmployeeType: { $in: ['SUPERADMIN', 'ADMIN'] } }).lean();
  const systemUserId = systemUser?._id;
  if (!systemUserId) {
    console.error('No admin user found — cannot proceed.');
    process.exit(1);
  }
  console.log(`Using system user: ${systemUser.employeeName} (${systemUserId})\n`);

  // Fetch all non-draft/cancelled BulkOrders
  const allOrders = await BulkOrder.find({}).lean();

  let inserted = 0;
  let alreadyExists = 0;
  let skipped = 0;

  for (const bo of allOrders) {
    const custId = bo.customer?.customerId;
    if (!custId) { skipped++; continue; }

    const activeSubOrders = bo.orders.filter(o => !EXCLUDED_STATUSES.includes(o.status));
    if (activeSubOrders.length === 0) { skipped++; continue; }

    const orderRef = activeSubOrders[0]?.orderNumber || bo._id.toString();

    // Find or create ledger for this customer
    let ledger = await CustomerLedger.findOne({ customerId: custId });
    if (!ledger) {
      const customer = await Customer.findById(custId).lean();
      if (!customer) { skipped++; continue; }
      ledger = await CustomerLedger.create({
        ledgerCode:    `CUST-LED-${custId.toString().slice(-6).toUpperCase()}`,
        customerId:    custId,
        creditLimit:   Number(customer.creditLimit || 0),
        creditDays:    0,
        creditUsed:    Number(customer.creditUsed || 0),
        advanceAmount: Number(customer.customerBalance || 0),
        currentBalance: Number(customer.creditUsed || 0) > 0
          ? Number(customer.creditUsed)
          : -Number(customer.customerBalance || 0),
        branchId:  customer.branchId || null,
        tenantId:  customer.tenantId || null,
        createdBy: systemUserId,
      });
      console.log(`  Created missing ledger for customer ${custId}`);
    }

    // Check if a LedgerTransaction already exists for this order reference
    const existing = await LedgerTransaction.findOne({
      ledgerId:        ledger._id,
      referenceNumber: orderRef,
      voucherType:     'Sales Invoice',
    });

    if (existing) {
      alreadyExists++;
      continue;
    }

    // Compute the order totals
    const grandTotal  = deriveGrandTotal(activeSubOrders, bo.shippingCharges, bo.otherCharges);
    const advancePaid = Number(bo.advanceAmount || 0);

    if (grandTotal <= 0) { skipped++; continue; }

    // Determine what went to credit vs absorbed from advance
    const unpaidAmount       = Math.max(0, grandTotal - advancePaid);
    const absorbedFromAdvance = Math.max(0, advancePaid - Math.max(0, advancePaid - grandTotal));
    // running balance = current ledger state (already corrected by backfillCustomerCreditFromOrders)
    const runningBalance = Number(ledger.currentBalance || 0);

    await LedgerTransaction.create({
      entityType:      'Customer',
      ledgerId:        ledger._id,
      partyId:         custId,
      transactionDate: bo.createdAt || new Date(),
      voucherType:     'Sales Invoice',
      voucherId:       bo._id,
      referenceNumber: orderRef,
      debit:           grandTotal,
      credit:          advancePaid > 0 ? Math.min(advancePaid, grandTotal) : 0,
      runningBalance,
      narration: `Sales Invoice for Order #${orderRef}. Total: ₹${grandTotal.toLocaleString()}, Advance Paid: ₹${advancePaid.toLocaleString()}${advancePaid > grandTotal ? (', Excess Advance: ₹' + (advancePaid - grandTotal).toLocaleString()) : (unpaidAmount > 0 ? (', Added to Credit Used: ₹' + unpaidAmount.toLocaleString()) : '')}.`,
      branchId:        ledger.branchId || null,
      tenantId:        ledger.tenantId || null,
      createdBy:       systemUserId,
    });

    console.log(`  ✓ Inserted LedgerTransaction for order ${orderRef} (customer ${custId}) — Total: ₹${grandTotal}, Advance: ₹${advancePaid}`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}, Already existed: ${alreadyExists}, Skipped: ${skipped}`);
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
