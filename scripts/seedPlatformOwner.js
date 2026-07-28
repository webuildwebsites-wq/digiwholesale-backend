import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Auth/Employee.js';

dotenv.config();

const EMAIL    = 'owner@digibysr.com';
const PASSWORD = 'Owner@2026';
const NAME     = 'Platform Owner';

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to DB');

    const existing = await Employee.findOne({ email: EMAIL });

    if (existing) {
        existing.password    = PASSWORD;
        existing.EmployeeType = 'PLATFORM_OWNER';
        existing.isActive    = true;
        await existing.save({ validateBeforeSave: false });
        console.log(`Updated existing employee → PLATFORM_OWNER: ${EMAIL}`);
    } else {
        let employeeCode = `PO${Date.now()}`;

        const employee = new Employee({
            employeeName:      NAME,
            username:          'platformowner',
            email:             EMAIL,
            password:          PASSWORD,
            phone:             '0000000000',
            address:           'Platform HQ',
            country:           'India',
            EmployeeType:      'PLATFORM_OWNER',
            employeeCode,
            tenantId:          null,
            isActive:          true,
            pageAccess:        [],
            accessPermissions: [],
        });

        await employee.save();
        console.log(`Created PLATFORM_OWNER: ${EMAIL}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
};

run().catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
});
