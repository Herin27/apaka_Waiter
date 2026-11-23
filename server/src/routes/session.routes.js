import { Router } from 'express';
import { closeTableSession } from '../controllers/order.controller.js';
import {
  getSessionBill,
  updateSessionTip,
  downloadSessionInvoicePdf,
  getThermalHtmlBill,
} from '../controllers/billing.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../utils/validators.js';

const router = Router();

router.use(protect, branchScope);

router.post(
  '/:id/close',
  authorize('waiter', 'cashier', 'admin', 'superadmin'),
  validate(idParamSchema),
  closeTableSession
);

router.get('/:id/bill', authorize('waiter', 'cashier', 'admin', 'superadmin'), getSessionBill);
router.patch('/:id/tip', authorize('waiter', 'cashier', 'admin', 'superadmin'), updateSessionTip);
router.get('/:id/invoice.pdf', authorize('waiter', 'cashier', 'admin', 'superadmin'), downloadSessionInvoicePdf);
router.get('/:id/thermal-bill', authorize('waiter', 'cashier', 'admin', 'superadmin'), getThermalHtmlBill);

export default router;
