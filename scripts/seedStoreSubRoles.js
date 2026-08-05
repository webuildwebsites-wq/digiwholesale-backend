import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Department from '../src/models/Auth/Department.js';
dotenv.config();

const DEPARTMENT_ID = '699e2ccef302b05880e31d8e';

const SUB_ROLES = [
  { name: 'Store Executive',        code: 'SE',   description: 'Handles store floor operations and customer assistance' },
  { name: 'Store Manager',          code: 'SM',   description: 'Manages overall store operations' },
  { name: 'Store Keeper',           code: 'SK',   description: 'Maintains physical storage and stock organization' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to database');

  const department = await Department.findById(DEPARTMENT_ID);

  if (!department) {
    console.error(`Department not found: ${DEPARTMENT_ID}`);
    process.exit(1);
  }

  console.log(`Department: ${department.name}`);

  let added = 0;
  let skipped = 0;

  for (const role of SUB_ROLES) {
    const exists = department.subRoles.some(sr => sr.code === role.code);
    if (exists) {
      console.log(`Skipped (already exists): ${role.code} — ${role.name}`);
      skipped++;
      continue;
    }
    department.subRoles.push({ ...role, isActive: true });
    console.log(`Added: ${role.code} — ${role.name}`);
    added++;
  }

  await department.save();

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}`);
  await mongoose.connection.close();
};

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
