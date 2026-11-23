import { Router } from 'express';
import {
  listOpenTablesWithBills,
  recordCashierPayments,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
  refundOrVoidPayment,
  listPayments,
} from '../controllers/billing.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

// Razorpay server-to-server webhook (raw body signature check, no JWT auth)
router.post('/razorpay/webhook', handleRazorpayWebhook);

// Protected cashier & admin payment endpoints
router.use(protect, branchScope);

router.get('/', authorize('cashier', 'admin', 'superadmin'), listPayments);
router.get('/open-tables', authorize('cashier', 'waiter', 'admin', 'superadmin'), listOpenTablesWithBills);
router.post('/record', authorize('cashier', 'admin', 'superadmin'), recordCashierPayments);

router.post('/razorpay/create-order', authorize('cashier', 'admin', 'superadmin'), createRazorpayOrder);
router.post('/razorpay/verify', authorize('cashier', 'admin', 'superadmin'), verifyRazorpayPayment);

// Refund / Void requires Admin approval
router.post('/:id/refund', authorize('admin', 'superadmin'), refundOrVoidPayment);

export default router;
