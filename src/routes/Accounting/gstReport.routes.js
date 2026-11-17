import express from 'express';
import { getGstReport, exportGstWorkbook } from '../../core/controllers/Accounting/gstReport.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

router.get('/', getGstReport);
router.get('/export', exportGstWorkbook);

export default router;
