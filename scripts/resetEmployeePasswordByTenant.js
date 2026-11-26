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



// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// dotenv.config();

// const EMAIL    = 'owner@digibysr.com';
// const PASSWORD = 'Owner@2026';

// const run = async () => {
//   await mongoose.connect(process.env.MONGODB_URL);
//   console.log('Connected to DB');

//   const employeeSchema = (await import('../src/models/Auth/Employee.js')).default;

//   const employee = await employeeSchema.findOne({ email: EMAIL }).select('+password');

//   if (!employee) {
//     console.error(`No employee found with email: ${EMAIL}`);
//     await mongoose.disconnect();
//     process.exit(1);
//   }

//   console.log(`Found: ${employee.employeeName} (${employee.email}) — Type: ${employee.EmployeeType}`);

//   employee.password = PASSWORD;
//   await employee.save({ validateBeforeSave: false });

//   console.log(`Password updated successfully for ${employee.email}`);
//   await mongoose.disconnect();
// };

// run().catch((err) => {
//   console.error('Script failed:', err);
//   process.exit(1);
// });
