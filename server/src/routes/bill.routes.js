import { Router } from 'express';
import { applyCouponToBill, removeCouponFromBill } from '../controllers/billing.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

router.use(protect, branchScope);

router.post('/apply-coupon', authorize('cashier', 'waiter', 'admin', 'superadmin'), applyCouponToBill);
router.delete('/remove-coupon', authorize('cashier', 'waiter', 'admin', 'superadmin'), removeCouponFromBill);

export default router;
