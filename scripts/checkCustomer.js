import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URL);

const Customer = mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));
const CustomerDraft = mongoose.model("CustomerDraft", new mongoose.Schema({}, { strict: false }));
const CustomerLedger = mongoose.model("CustomerLedger", new mongoose.Schema({}, { strict: false }));

console.log("=== Querying Customer ===");
let c = null;
try {
  c = await Customer.findOne({
    $or: [
      { _id: new mongoose.Types.ObjectId("6a956d3c00b8a225fbd7bfc1") },
      { mobileNo1: "9815777790" },
      { shopName: /Jodhpur/i }
    ]
  }).lean();
} catch (err) {
  console.log("Customer query err:", err.message);
}

if (c) {
  console.log("FOUND in Customer:", JSON.stringify({
    _id: c._id,
    customerCode: c.customerCode,
    shopName: c.shopName,
    ownerName: c.ownerName,
    mobileNo1: c.mobileNo1,
    status: c.status,
    approvalStage: c.approvalStage,
    tenantId: c.tenantId,
    createdBy: c.createdBy,
    isDeleted: c.isDeleted,
    deletedAt: c.deletedAt,
    registrationStage: c.registrationStage,
  }, null, 2));
} else {
  console.log("NOT found in Customer");
}

console.log("=== Querying CustomerDraft ===");
let cd = null;
try {
  cd = await CustomerDraft.findOne({
    $or: [
      { _id: new mongoose.Types.ObjectId("6a956d3c00b8a225fbd7bfc1") },
      { mobileNo1: "9815777790" },
      { shopName: /Jodhpur/i }
    ]
  }).lean();
} catch (err) {
  console.log("CustomerDraft query err:", err.message);
}

if (cd) {
  console.log("FOUND in CustomerDraft:", JSON.stringify({
    _id: cd._id,
    customerCode: cd.customerCode,
    shopName: cd.shopName,
    ownerName: cd.ownerName,
    mobileNo1: cd.mobileNo1,
    status: cd.status,
    approvalStage: cd.approvalStage,
    tenantId: cd.tenantId,
    stage: cd.stage,
  }, null, 2));
} else {
  console.log("NOT found in CustomerDraft");
}

console.log("=== Querying CustomerLedger ===");
let cl = null;
try {
  cl = await CustomerLedger.findOne({
    $or: [
      { customerId: new mongoose.Types.ObjectId("6a956d3c00b8a225fbd7bfc1") },
      { ledgerCode: /D7BFC1/i }
    ]
  }).lean();
} catch (err) {
  console.log("CustomerLedger query err:", err.message);
}

if (cl) {
  console.log("FOUND in CustomerLedger:", JSON.stringify({
    _id: cl._id,
    customerId: cl.customerId,
    ledgerCode: cl.ledgerCode,
    currentBalance: cl.currentBalance,
    creditUsed: cl.creditUsed,
    advanceAmount: cl.advanceAmount,
    tenantId: cl.tenantId,
  }, null, 2));
} else {
  console.log("NOT found in CustomerLedger");
}

await mongoose.disconnect();
