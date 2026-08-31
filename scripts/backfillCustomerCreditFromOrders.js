import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Customer from '../src/models/Auth/Customer.js';
import CustomerLedger from '../src/models/Accounting/CustomerLedger.model.js';
import BulkOrder from '../src/models/order/BulkOrder.js';
import Payment from '../src/models/Accounting/Payment.model.js';
import LedgerTransaction from '../src/models/Accounting/LedgerTransaction.model.js';

const EXCLUDED_STATUSES = ['Draft', 'Cancelled'];

// Derive an order's total from its sub-order items
const deriveOrderTotal = (orders, advanceAmount, shippingCharges, otherCharges) => {
  let total = 0;
  for (const ord of orders) {
    if (ord.grossTotalWithCharges && Number(ord.grossTotalWithCharges) > 0) {
      total += Number(ord.grossTotalWithCharges);
    } else if (ord.totalOrderPrice && Number(ord.totalOrderPrice) > 0) {
      total += Number(ord.totalOrderPrice);
    } else if (Array.isArray(ord.items)) {
      for (const it of ord.items) {
        const price = Number(it.price || 0);
        const qty   = Number(it.qty   || 1);
        const disc  = Number(it.discountAmount || 0);
        const taxable = Math.max(0, price * qty - disc);
        const gst = Number(it.gst || 0);
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

  // 1. Fetch all active (non-draft, non-cancelled) BulkOrders
  const allOrders = await BulkOrder.find({
    'orders.status': { $nin: EXCLUDED_STATUSES }
  }).lean();

  // 2. Group by customerId
  const byCustomer = new Map();
  for (const bo of allOrders) {
    const custId = bo.customer?.customerId?.toString();
    if (!custId) continue;

    // Only consider sub-orders that are not Draft/Cancelled
    const activeSubOrders = bo.orders.filter(o => !EXCLUDED_STATUSES.includes(o.status));
    if (activeSubOrders.length === 0) continue;

    if (!byCustomer.has(custId)) byCustomer.set(custId, []);
    byCustomer.get(custId).push({
      bulkOrderId:    bo._id,
      orderRef:       activeSubOrders[0]?.orderNumber || bo._id.toString(),
      grandTotal:     deriveOrderTotal(activeSubOrders, bo.advanceAmount, bo.shippingCharges, bo.otherCharges),
      advancePaid:    Number(bo.advanceAmount || 0),
    });
  }

  console.log(`Found ${byCustomer.size} customers with active orders.\n`);

  let updated = 0;
  let skipped = 0;

  for (const [custIdStr, orders] of byCustomer) {
    const customer = await Customer.findById(custIdStr);
    if (!customer) {
      console.warn(`  SKIP — Customer ${custIdStr} not found in DB`);
      skipped++;
      continue;
    }

    // 3. Sum all order-level unpaid amounts and advance excesses
    let totalOrderAmount  = 0;
    let totalAdvancePaid  = 0;
    for (const ord of orders) {
      totalOrderAmount += ord.grandTotal;
      totalAdvancePaid += ord.advancePaid;
    }

    // 4. Sum all completed customer payment inflows (non-cheque COMPLETED + CLEARED cheques)
    const payments = await Payment.find({
      partyId:      customer._id,
      partyModel:   'Customer',
      type:         'CUSTOMER_INFLOW',
      status:       { $in: ['COMPLETED', 'CLEARED'] },
      paymentMode:  { $ne: 'ADVANCE_ADJUSTMENT' }
    }).lean();

    const totalPaymentsReceived = payments.reduce((sum, p) => sum + Number(p.grossAmount || 0), 0);

    // Advance adjustment (knock-offs) also reduce credit used — fetch those too
    const adjustments = await Payment.find({
      partyId:     customer._id,
      partyModel:  'Customer',
      type:        'CUSTOMER_INFLOW',
      status:      'COMPLETED',
      paymentMode: 'ADVANCE_ADJUSTMENT'
    }).lean();
    const totalAdjusted = adjustments.reduce((sum, p) => sum + Number(p.grossAmount || 0), 0);

    // 5. Compute correct creditUsed and customerBalance
    //    Net receivable = total order amount - all advance paid at order time
    //    Then subtract all payments received subsequently
    const netReceivable = totalOrderAmount - totalAdvancePaid;

    let finalCreditUsed    = 0;
    let finalAdvanceBalance = 0;

    if (netReceivable > 0) {
      // Customer owes money; payments reduce the due
      const paidAgainstDue = totalPaymentsReceived + totalAdjusted;
      if (paidAgainstDue >= netReceivable) {
        finalCreditUsed     = 0;
        finalAdvanceBalance = paidAgainstDue - netReceivable;
      } else {
        finalCreditUsed     = netReceivable - paidAgainstDue;
        finalAdvanceBalance = 0;
      }
    } else {
      // Advance paid > order total; excess is their advance balance
      finalAdvanceBalance = Math.abs(netReceivable) + totalPaymentsReceived;
      finalCreditUsed     = 0;
    }

    finalCreditUsed     = Math.max(0, finalCreditUsed);
    finalAdvanceBalance = Math.max(0, finalAdvanceBalance);

    console.log(
      `  Customer: ${customer.shopName || customer.ownerName} (${custIdStr})\n` +
      `    Orders Total:  ₹${totalOrderAmount.toFixed(2)}\n` +
      `    Advance Paid:  ₹${totalAdvancePaid.toFixed(2)}\n` +
      `    Payments Rcvd: ₹${totalPaymentsReceived.toFixed(2)}\n` +
      `    Adjustments:   ₹${totalAdjusted.toFixed(2)}\n` +
      `    → creditUsed:  ₹${finalCreditUsed.toFixed(2)}  (was ₹${Number(customer.creditUsed||0).toFixed(2)})\n` +
      `    → advBalance:  ₹${finalAdvanceBalance.toFixed(2)}  (was ₹${Number(customer.customerBalance||0).toFixed(2)})`
    );

    // 6. Write to Customer
    await Customer.findByIdAndUpdate(customer._id, {
      $set: {
        creditUsed:      finalCreditUsed,
        customerBalance: finalAdvanceBalance,
      }
    });

    // 7. Write to CustomerLedger (upsert)
    const finalBalance = finalCreditUsed > 0 ? finalCreditUsed : -finalAdvanceBalance;
    let ledger = await CustomerLedger.findOne({ customerId: customer._id });
    if (!ledger) {
      ledger = new CustomerLedger({
        ledgerCode:   `CUST-LED-${customer._id.toString().slice(-6).toUpperCase()}`,
        customerId:   customer._id,
        creditLimit:  Number(customer.creditLimit || 0),
        creditDays:   0,
        creditUsed:   finalCreditUsed,
        advanceAmount: finalAdvanceBalance,
        currentBalance: finalBalance,
        branchId:     customer.branchId || null,
        tenantId:     customer.tenantId || null,
        createdBy:    null,
      });
    } else {
      ledger.creditUsed     = finalCreditUsed;
      ledger.advanceAmount  = finalAdvanceBalance;
      ledger.currentBalance = finalBalance;
    }
    await ledger.save();

    updated++;
    console.log(`    ✓ Updated\n`);
  }

  console.log(`\nBackfill complete. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Backfill script error:', err);
  process.exit(1);
});
