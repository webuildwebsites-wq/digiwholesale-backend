import express from 'express';
import { 
  getAccountTree, 
  getAccountsList, 
  createAccount, 
  updateAccount 
} from '../../core/controllers/Accounting/account.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

router.get('/tree', getAccountTree);
router.get('/', getAccountsList);
router.post('/', createAccount);
router.put('/:id', updateAccount);

export default router;
