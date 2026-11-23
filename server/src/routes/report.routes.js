import { Router } from 'express';
import { getZReport } from '../controllers/billing.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

router.use(protect, branchScope);

router.get('/z-report', authorize('cashier', 'admin', 'superadmin'), getZReport);

export default router;
