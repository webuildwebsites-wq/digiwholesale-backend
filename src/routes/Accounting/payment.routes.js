import express from 'express';
import { 
  executeCustomerPayment, 
  executeVendorPayment, 
  updateChequeStatus, 
  getPaymentsList, 
  getPaymentById,
  adjustDueFromAdvance
} from '../../core/controllers/Accounting/payment.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

// Customer Inflow
router.post('/customer', executeCustomerPayment);

// Adjust Credit Due from Advance Jama Balance
router.post('/adjust-advance', adjustDueFromAdvance);

// Vendor Outflow
router.post('/vendor', executeVendorPayment);

// Cheque Lifecycle (Clear / Bounce / Deposit)
router.patch('/:id/cheque-status', updateChequeStatus);

// Payment Listings & Details
router.get('/', getPaymentsList);
router.get('/:id', getPaymentById);

export default router;
