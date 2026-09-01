import connectDB from '../src/core/config/DB/connectDb.js';
import Account from '../src/models/Accounting/Account.model.js';

const check = async () => {
  await connectDB();
  const count = await Account.countDocuments({});
  console.log('Total accounts count:', count);
  const sample = await Account.find({}).limit(5).lean();
  console.log('Sample accounts:', sample);
  process.exit(0);
};

check();
