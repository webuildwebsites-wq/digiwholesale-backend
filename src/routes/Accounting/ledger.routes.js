import express from 'express';
import { 
  getCustomerLedgerStatement, 
  getVendorLedgerStatement, 
  getCustomerLedgersList, 
  getVendorLedgersList, 
  upsertCustomerLedger, 
  upsertVendorLedger 
} from '../../core/controllers/Accounting/ledger.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

// Customer Ledgers & Khata Statements
router.get('/customers', getCustomerLedgersList);
router.get('/customer/:customerId', getCustomerLedgerStatement);
router.post('/customer/upsert', upsertCustomerLedger);

// Vendor Ledgers & Statements
router.get('/vendors', getVendorLedgersList);
router.get('/vendor/:vendorId', getVendorLedgerStatement);
router.post('/vendor/upsert', upsertVendorLedger);

export default router;
