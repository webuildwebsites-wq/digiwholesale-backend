import express from 'express';
import { 
  getCustomerLedgerStatement, 
  getVendorLedgerStatement, 
  getCustomerLedgersList, 
  getVendorLedgersList, 
  upsertCustomerLedger, 
  upsertVendorLedger 
} from '../../core/controllers/Accounting/ledger.controller.js';
import { sendPaymentDueReminder } from '../../core/controllers/Accounting/payment.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

// Customer Ledgers & Khata Statements
router.get('/customers', getCustomerLedgersList);
router.get('/customer/:customerId', getCustomerLedgerStatement);
router.post('/customer/upsert', upsertCustomerLedger);
router.post('/customer/:customerId/send-due-reminder', (req, res, next) => {
  req.body = { ...req.body, partyId: req.params.customerId, entityType: 'Customer' };
  return sendPaymentDueReminder(req, res, next);
});

// Vendor Ledgers & Statements
router.get('/vendors', getVendorLedgersList);
router.get('/vendor/:vendorId', getVendorLedgerStatement);
router.post('/vendor/upsert', upsertVendorLedger);
router.post('/vendor/:vendorId/send-due-reminder', (req, res, next) => {
  req.body = { ...req.body, partyId: req.params.vendorId, entityType: 'Vendor' };
  return sendPaymentDueReminder(req, res, next);
});

export default router;
