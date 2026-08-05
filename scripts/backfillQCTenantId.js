import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PurchaseQC from '../src/models/Purchase/PurchaseQC.model.js';
import VendorPurchase from '../src/models/Purchase/VendorPurchase.model.js';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to database');

  const qcsWithoutTenant = await PurchaseQC.find({ tenantId: null }).lean();
  console.log(`Found ${qcsWithoutTenant.length} QC records without tenantId`);

  let updated = 0;
  for (const qc of qcsWithoutTenant) {
    const po = await VendorPurchase.findById(qc.purchaseOrderId).lean();
    if (po?.tenantId) {
      await PurchaseQC.updateOne({ _id: qc._id }, { $set: { tenantId: po.tenantId } });
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
