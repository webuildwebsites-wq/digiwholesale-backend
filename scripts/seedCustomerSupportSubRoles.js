import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Department from '../src/models/Auth/Department.js';
dotenv.config();

const DEPARTMENT_ID = '699e2ccef302b05880e31d90';

const SUB_ROLES = [
  { name: 'Customer Support Executive',   code: 'CSE',  description: 'Handles inbound customer queries and complaints' },
  { name: 'Customer Onboarding Specialist', code: 'COS', description: 'Onboards new customers and provides initial training' },
  { name: 'Support Quality Analyst',      code: 'SQA',  description: 'Monitors and ensures quality of support interactions' },
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
