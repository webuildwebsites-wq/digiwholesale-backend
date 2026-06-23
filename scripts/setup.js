import mongoose from 'mongoose';
import dotenv from 'dotenv';
import employeeSchema from '../src/models/Auth/Employee.js';
import { generateEmployeeCode } from '../src/Utils/Auth/customerAuthUtils.js';

dotenv.config();

const setupProject = async () => {
  try {
    console.log('Starting VisualEyes ERP Setup...\n');

    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to database');

    // Create default superadmin details
    const superAdminData = {
      username: 'Ruchica G',
      employeeName: 'Ruchica',
      email: 'ruchica@digibysr.com',
      password: 'director',
      phone: '9899119993',
      address: 'Hauz Khas new delhi india',
      country: 'India',
      pincode: '123456',
      EmployeeType: 'SUPERADMIN',
      Department: {
        name: 'SUPERADMIN',
        refId: null
      },
      isActive: true,
      profile: {
        dateOfJoining: new Date()
      },
    };

    let employeeCode = generateEmployeeCode(superAdminData.employeeName);
    let codeExists = true;
    while (codeExists) {
      const existing = await employeeSchema.findOne({ employeeCode });
      if (!existing) codeExists = false;
      else employeeCode = generateEmployeeCode(superAdminData.employeeName);
    }
    superAdminData.employeeCode = employeeCode;

    const superAdmin = new employeeSchema(superAdminData);
    await superAdmin.save();

    console.log('\n✓ Project setup completed successfully!');
    console.log('\nSuperAdmin Account Created:');
    console.log('Username:', superAdmin.username);
    console.log('Email:', superAdmin.email);
    console.log('Full Name:', superAdmin.employeeName);
    console.log('Phone:', superAdmin.phone);
    console.log('Password: anish@2026');

  } catch (error) {
    console.error('Setup failed:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      console.error('Validation errors:', messages.join(', '));
    }

    if (error.code === 11000) {
      console.error('✗ Duplicate key error: Employee with this email or username already exists');
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

setupProject();