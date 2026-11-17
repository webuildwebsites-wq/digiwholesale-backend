import express from 'express';
import { getAllSystemNotifications } from '../../core/controllers/Notification/notification.controller.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const router = express.Router();

router.use(ProtectUser);

router.get('/all', getAllSystemNotifications);
router.get('/', getAllSystemNotifications);

export default router;

