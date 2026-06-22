import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Vendor from '../src/models/Vendor.model.js';

dotenv.config();

const seedVendor = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const existing = await Vendor.findOne({ email: 'testingd12221@gmail.com' });
    if (existing) {
      console.log('Vendor with this email already exists:', existing._id.toString());
      return;
    }

    const vendor = await Vendor.create({
      name:         'Anish Singh Rawat',
      firm:         'ANISH Singh RAWAT ',
      mobile:       '916395607666',
      email:        'testingd12221@gmail.com',
      address:      'NEW DELHI, INDIA',
      gstNumber:    '',
      paymentTerms: 'CASH',
      notes:        '',
    });

    console.log('Vendor created successfully');
    console.log('ID    :', vendor._id.toString());
    console.log('Name  :', vendor.name);
    console.log('Email :', vendor.email);
    console.log('Mobile:', vendor.mobile);

  } catch (error) {
    console.error('Seed failed:', error.message);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', messages.join(', '));
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

seedVendor();
