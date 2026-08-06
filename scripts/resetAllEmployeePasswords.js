import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
dotenv.config();

const TENANT_ID = 'TEN-ANISHO-77SKV';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const getKey = () => {
  const secret = process.env.PASSWORD_SECRET;
  if (!secret) throw new Error('PASSWORD_SECRET is not set');
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptPassword = (plain) => {
  try {
    const iv        = crypto.randomBytes(IV_LENGTH);
    const cipher    = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    console.error('Encrypt error:', e.message);
    return null;
  }
};

const run = async () => {
  console.log('PASSWORD_SECRET set:', !!process.env.PASSWORD_SECRET);

  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to database\n');

  const Employee = mongoose.model(
    'employee',
    new mongoose.Schema({}, { strict: false })
  );

  const employees = await Employee.find({ tenantId: TENANT_ID }, { email: 1, employeeName: 1 });
  console.log(`Found ${employees.length} employees for tenant: ${TENANT_ID}\n`);

  let updated = 0;
  let failed  = 0;

  for (const emp of employees) {
    try {
      const plain          = emp.email.split('@')[0];
      const salt           = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(plain, salt);
      const encrypted      = encryptPassword(plain);

      await Employee.updateOne(
        { _id: emp._id },
        { $set: { password: hashedPassword, encryptedPassword: encrypted } }
      );

      console.log(`✓ ${emp.email.padEnd(40)} → password: ${plain} | encrypted: ${encrypted ? 'OK' : 'FAILED'}`);
      updated++;
    } catch (err) {
      console.error(`✗ ${emp.email} → ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Updated : ${updated}`);
  console.log(`Failed  : ${failed}`);

  await mongoose.connection.close();
  console.log('Done. Connection closed.');
};

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
