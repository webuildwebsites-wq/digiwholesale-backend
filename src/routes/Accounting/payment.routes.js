import express from "express";
import {
  executeCustomerPayment,
  executeVendorPayment,
  updateChequeStatus,
  getPaymentsList,
  getPaymentById,
  adjustDueFromAdvance,
  getPaymentReceipt,
  sendPaymentDueReminder,
  resendPaymentReceiptNotification,
} from "../../core/controllers/Accounting/payment.controller.js";
import { ProtectUser } from "../../middlewares/Auth/AdminMiddleware/adminMiddleware.js";

const router = express.Router();

router.use(ProtectUser);

// Customer Inflow
router.post("/customer", executeCustomerPayment);

// Adjust Credit Due from Advance Jama Balance
router.post("/adjust-advance", adjustDueFromAdvance);

// Vendor Outflow
router.post("/vendor", executeVendorPayment);

// Send Payment Due Reminder (WhatsApp + Email)
router.post("/due-reminder", sendPaymentDueReminder);
router.post("/send-due-reminder", sendPaymentDueReminder);

// Cheque Lifecycle (Clear / Bounce / Deposit)
router.patch("/:id/cheque-status", updateChequeStatus);

// Payment Listings & Details
router.get("/", getPaymentsList);
router.get("/:id", getPaymentById);

// Download / View Payment Receipt PDF
router.get("/:id/receipt", getPaymentReceipt);

// Resend Receipt Notification via WhatsApp / Email
router.post("/:id/resend-receipt", resendPaymentReceiptNotification);
router.post("/:id/send-whatsapp", resendPaymentReceiptNotification);

export default router;

