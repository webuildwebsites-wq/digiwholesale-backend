import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PurchaseReturn from '../src/models/Purchase/PurchaseReturn.model.js';
import VendorPurchase from '../src/models/Purchase/VendorPurchase.model.js';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to database');

  const records = await PurchaseReturn.find({ tenantId: null }).lean();
  console.log(`Found ${records.length} PurchaseReturn records without tenantId`);

  let updated = 0;
  for (const record of records) {
    const po = await VendorPurchase.findById(record.purchaseOrderId).lean();
    if (po?.tenantId) {
      await PurchaseReturn.updateOne({ _id: record._id }, { $set: { tenantId: po.tenantId } });
      updated++;
    }
  }

  console.log(`Updated: ${updated} records`);
  await mongoose.connection.close();
  console.log('Done.');
};

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
