import { Router } from 'express';
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/billing.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

router.use(protect, branchScope);

router.get('/', authorize('cashier', 'waiter', 'admin', 'superadmin'), listCoupons);
router.post('/', authorize('admin', 'superadmin'), createCoupon);
router.patch('/:id', authorize('admin', 'superadmin'), updateCoupon);
router.delete('/:id', authorize('admin', 'superadmin'), deleteCoupon);

export default router;
