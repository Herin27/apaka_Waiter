import { Router } from 'express';
import {
  listOrders,
  waiterPlaceOrder,
  confirmOrder,
  rejectOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderItemStatus,
} from '../controllers/order.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  waiterCreateOrderSchema,
  rejectOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  updateOrderItemStatusSchema,
  idParamSchema,
} from '../utils/validators.js';

const router = Router();

router.use(protect, branchScope);

router.get('/', listOrders);
router.post('/', authorize('waiter', 'admin', 'superadmin'), validate(waiterCreateOrderSchema), waiterPlaceOrder);
router.patch('/:id/confirm', authorize('waiter', 'admin', 'superadmin'), validate(idParamSchema), confirmOrder);
router.patch('/:id/reject', authorize('waiter', 'admin', 'superadmin'), validate(rejectOrderSchema), rejectOrder);
router.patch(
  '/:id/status',
  authorize('kitchen', 'waiter', 'admin', 'superadmin'),
  validate(updateOrderStatusSchema),
  updateOrderStatus
);
router.patch(
  '/:id/cancel',
  authorize('waiter', 'admin', 'superadmin'),
  validate(cancelOrderSchema),
  cancelOrder
);
router.patch(
  '/:id/items/:itemId/status',
  authorize('kitchen', 'waiter', 'admin', 'superadmin'),
  validate(updateOrderItemStatusSchema),
  updateOrderItemStatus
);

export default router;
