import express from 'express';
import { getAgingReport } from '../../core/controllers/Accounting/aging.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

router.get('/', getAgingReport);

export default router;
