import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import VendorLedger from '../src/models/Accounting/VendorLedger.model.js';
import LedgerTransaction from '../src/models/Accounting/LedgerTransaction.model.js';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to MongoDB\n');

  const ledgers = await VendorLedger.find({}).select('_id').lean();
  const ledgerIds = ledgers.map(l => l._id);

  const txnResult = await LedgerTransaction.deleteMany({
    $or: [
      { ledgerId: { $in: ledgerIds } },
      { entityType: 'Vendor' }
    ]
  });

  const ledgerResult = await VendorLedger.deleteMany({});

  console.log(`Deleted ${txnResult.deletedCount} vendor LedgerTransactions`);
  console.log(`Deleted ${ledgerResult.deletedCount} VendorLedger records`);

  await mongoose.disconnect();
};

run().catch(err => { console.error('Script error:', err); process.exit(1); });
