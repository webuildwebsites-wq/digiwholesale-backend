import mongoose from 'mongoose';
import dotenv from 'dotenv';
import employeeSchema from '../src/models/Auth/Employee.js';

dotenv.config();

const TENANT_ID = 'TEN-ANISHO-77SKV';
const EMAIL = 'anishsinghrawat1@gmail.com';
const NEW_PASSWORD = 'anishsinghrawat1';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to database');

  const employee = await employeeSchema.findOne({
    tenantId: TENANT_ID,
    email: EMAIL,
  }).select('+password');

  if (!employee) {
    console.log(`No employee found with email "${EMAIL}" and tenantId "${TENANT_ID}"`);
    await mongoose.connection.close();
    process.exit(0);
  }

  employee.password = NEW_PASSWORD;
  await employee.save();

  console.log(`Password updated successfully for: ${employee.employeeName} (${employee.email})`);

  await mongoose.connection.close();
  console.log('Done. Connection closed.');
};

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
