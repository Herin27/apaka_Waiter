import { Router } from 'express';
import {
  listWaiterCalls,
  acknowledgeWaiterCall,
  resolveWaiterCall,
} from '../controllers/order.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../utils/validators.js';

const router = Router();

router.use(protect, branchScope);

router.get('/', listWaiterCalls);
router.patch(
  '/:id/acknowledge',
  authorize('waiter', 'admin', 'superadmin'),
  validate(idParamSchema),
  acknowledgeWaiterCall
);
router.patch(
  '/:id/resolve',
  authorize('waiter', 'admin', 'superadmin'),
  validate(idParamSchema),
  resolveWaiterCall
);

export default router;
