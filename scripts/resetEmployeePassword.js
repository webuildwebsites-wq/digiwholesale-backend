import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const EMAIL    = 'owner@digibysr.com';
const PASSWORD = 'Owner@2026';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to DB');

  const employeeSchema = (await import('../src/models/Auth/Employee.js')).default;

  const employee = await employeeSchema.findOne({ email: EMAIL }).select('+password');

  if (!employee) {
    console.error(`No employee found with email: ${EMAIL}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found: ${employee.employeeName} (${employee.email}) — Type: ${employee.EmployeeType}`);

  employee.password = PASSWORD;
  await employee.save({ validateBeforeSave: false });

  console.log(`Password updated successfully for ${employee.email}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
