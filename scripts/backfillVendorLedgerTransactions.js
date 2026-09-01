import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import VendorPurchase from '../src/models/Purchase/VendorPurchase.model.js';
import VendorLedger from '../src/models/Accounting/VendorLedger.model.js';
import LedgerTransaction from '../src/models/Accounting/LedgerTransaction.model.js';
import Employee from '../src/models/Auth/Employee.js';

const EXCLUDED_STATUSES = ['Closed'];

const deriveOrderTotal = (orders) => {
  let total = 0;
  for (const ord of orders) {
    if (ord.totalOrderPrice && Number(ord.totalOrderPrice) > 0) {
      total += Number(ord.totalOrderPrice);
    } else if (Array.isArray(ord.items)) {
      for (const it of ord.items) {
        const price = Number(it.price || 0);
        const qty   = Number(it.qty   || 1);
        const disc  = Number(it.discountAmount || 0);
        const taxable = Math.max(0, price * qty - disc);
        total += taxable + taxable * (Number(it.gst || 0) / 100);
      }
    }
  }
  return total;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to MongoDB\n');

  const systemUser = await Employee.findOne({ EmployeeType: { $in: ['SUPERADMIN', 'ADMIN'] } }).lean();
  const systemUserId = systemUser?._id;
  if (!systemUserId) { console.error('No admin user found.'); process.exit(1); }
  console.log(`Using system user: ${systemUser.employeeName} (${systemUserId})\n`);

  const allPurchases = await VendorPurchase.find({}).lean();

  let inserted = 0;
  let alreadyExists = 0;
  let skipped = 0;

  for (const po of allPurchases) {
    const vendorId = po.vendor?.vendorId;
    if (!vendorId) { skipped++; continue; }

    const activeOrders = po.orders.filter(o => !EXCLUDED_STATUSES.includes(o.status));
    if (activeOrders.length === 0) { skipped++; continue; }

    const orderRef = activeOrders[0]?.orderNumber || po._id.toString();
    const grandTotal = deriveOrderTotal(activeOrders);
    if (grandTotal <= 0) { skipped++; continue; }

    let ledger = await VendorLedger.findOne({ vendorId });
    if (!ledger) {
      ledger = await VendorLedger.create({
        ledgerCode:         `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
        vendorId,
        vendorCategory:     'Manufacturer',
        paymentTerms:       0,
        openingBalance:     0,
        currentOutstanding: grandTotal,
        branchId:           null,
        tenantId:           po.tenantId || null,
        createdBy:          systemUserId,
      });
      console.log(`  Created missing ledger for vendor ${vendorId}`);
    }

    const existing = await LedgerTransaction.findOne({
      ledgerId:        ledger._id,
      referenceNumber: orderRef,
      voucherType:     'Purchase Invoice',
    });
    if (existing) { alreadyExists++; continue; }

    await LedgerTransaction.create({
      entityType:      'Vendor',
      ledgerId:        ledger._id,
      partyId:         vendorId,
      transactionDate: po.createdAt || new Date(),
      voucherType:     'Purchase Invoice',
      voucherId:       po._id,
      referenceNumber: orderRef,
      debit:           0,
      credit:          grandTotal,
      runningBalance:  Number(ledger.currentOutstanding || 0),
      narration:       `Purchase Order #${orderRef}. Total: ₹${grandTotal.toLocaleString()}. Vendor: ${po.vendor.vendorName}.`,
      branchId:        null,
      tenantId:        po.tenantId || null,
      createdBy:       systemUserId,
    });

    console.log(`  ✓ Inserted LedgerTransaction for PO ${orderRef} (vendor ${vendorId}) — ₹${grandTotal.toFixed(2)}`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}, Already existed: ${alreadyExists}, Skipped: ${skipped}`);
  await mongoose.disconnect();
};

run().catch(err => { console.error('Script error:', err); process.exit(1); });
