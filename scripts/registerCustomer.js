import mongoose from "mongoose";
import dotenv from "dotenv";
import Customer from "../src/models/Auth/Customer.js";
import Employee from "../src/models/Auth/Employee.js";
import { generateCustomerCode, generateRandomPassword } from "../src/Utils/Auth/customerAuthUtils.js";

dotenv.config();

async function run() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error("MONGODB_URL environment variable is missing.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUrl);
  console.log("Connected to MongoDB successfully.\n");

  const targetTenantId = "TEN-ANISHS-Z6AXY";

  // 1. Find creator employee/admin for this tenant
  let creator = await Employee.findOne({ tenantId: targetTenantId }).lean();
  if (!creator) {
    creator = await Employee.findOne({}).lean();
  }

  if (!creator) {
    console.error("No employee found in database to assign as createdBy.");
    process.exit(1);
  }

  console.log(`Using creator: ${creator.employeeName} (ID: ${creator._id}) for tenant: ${targetTenantId}`);

  // Customer specifications provided:
  const shopName = "ASHA KIRAN MULTI SPECILALITY EYE ,HOSPITAL";
  const address = "WARD NO-9, GAGOR , VIJAYPUR JAMMU-";
  const pinCode = "184120";
  const state = "Jammu and Kashmir";
  const city = "Vijaypur";
  const country = "India";
  const mobile1 = "9456534864";
  const mobile2 = "7579440117";
  const mobile3 = "9463030557";

  // 2. Check if customer already exists, remove to register cleanly
  const existing = await Customer.findOne({
    tenantId: targetTenantId,
    $or: [
      { mobileNo1: mobile1 },
      { mobileNo2: mobile2 },
      { shopName: shopName.trim() }
    ]
  });

  if (existing) {
    console.log(`Found existing record for ${shopName} (ID: ${existing._id}). Removing to register cleanly...`);
    await Customer.deleteOne({ _id: existing._id });
  }

  // 3. Generate unique customerCode
  let code = generateCustomerCode(shopName);
  let codeExists = true;
  while (codeExists) {
    const found = await Customer.findOne({ customerCode: code });
    if (!found) {
      codeExists = false;
    } else {
      code = generateCustomerCode(shopName);
    }
  }

  // 4. Generate random initial password
  const initialPassword = generateRandomPassword();

  // 5. Prepare customer document with required model fields filled with clean defaults
  const newCustomerData = {
    shopName: shopName.trim(),
    firmName: shopName.trim(),
    ownerName: "N/A", // Marked N/A as Owner Full Name was not provided in legacy data
    proprietorName: "N/A",
    tenantId: targetTenantId,
    orderMode: "Online",
    mobileNo1: mobile1,
    mobileNo2: mobile2,
    isGSTRegistered: false,

    // Bill To Address populated with provided address details
    billToAddress: {
      branchName: "Main Branch",
      customerContactName: "N/A",
      customerContactNumber: mobile1,
      country: country,
      state: state,
      city: city,
      zipCode: pinCode,
      address: address.trim(),
      billingCurrency: "INR",
      billingMode: "Direct",
      createdBy: creator._id,
    },

    customerShipToDetails: [],
    customerCode: code,
    password: initialPassword,

    // Pre-approved so the customer is immediately active
    approvalWorkflow: {
      financeApprovalStatus: "APPROVED",
      financeApprovedBy: creator._id,
      financeApprovedAt: new Date(),
      salesHeadApprovalStatus: "APPROVED",
      salesHeadApprovedBy: creator._id,
      salesHeadApprovedAt: new Date(),
      financeRemark: "Migrated from legacy CRM directly via backend script.",
      salesHeadRemark: "Approved via migration script."
    },

    status: {
      isActive: true,
      isSuspended: false
    },

    creditLimit: 0,
    creditUsed: 0,
    customerBalance: 0,
    dcWithoutValue: false,
    designation: "Customer",
    createdBy: creator._id,
    createdByName: creator.employeeName || "Admin",
    createdByDepartment: "SUPERADMIN",

    // Record third mobile number in remark for future reference
    chequeRemark: `Legacy migration. Additional contact: ${mobile3}`,
    termsAndConditionsAccepted: true,
    termsAcceptedAt: new Date()
  };

  console.log("\nRegistering customer in MongoDB...");
  const createdCustomer = await Customer.create(newCustomerData);

  console.log("\n Customer successfully registered in the database!");
  console.log({
    _id: createdCustomer._id,
    customerCode: createdCustomer.customerCode,
    shopName: createdCustomer.shopName,
    ownerName: createdCustomer.ownerName,
    billToAddress: {
      branchName: createdCustomer.billToAddress?.branchName,
      address: createdCustomer.billToAddress?.address,
      city: createdCustomer.billToAddress?.city,
      state: createdCustomer.billToAddress?.state,
      zipCode: createdCustomer.billToAddress?.zipCode,
      country: createdCustomer.billToAddress?.country
    },
    mobileNo1: createdCustomer.mobileNo1,
    mobileNo2: createdCustomer.mobileNo2,
    additionalMobile: mobile3,
    isGSTRegistered: createdCustomer.isGSTRegistered,
    tenantId: createdCustomer.tenantId,
    status: createdCustomer.status,
    serialNumber: createdCustomer.serialNumber
  });

  await mongoose.disconnect();
  console.log("\nDisconnected from database. Done.");
}

run().catch((err) => {
  console.error("Migration script error:", err);
  process.exit(1);
});
