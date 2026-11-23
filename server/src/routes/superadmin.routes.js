import { Router } from 'express';
import {
  createDemoLead,
  getDemoPublicInfo,
  simulateRandomCustomerOrder,
  listAllRestaurants,
  createRestaurantWithAdmin,
  toggleRestaurantStatus,
} from '../controllers/superadmin.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public Landing & Demo Routes
router.post('/public/leads', createDemoLead);
router.get('/public/demo/info', getDemoPublicInfo);

// Admin-only Customer Order Simulator
router.post(
  '/demo/simulate-customer',
  protect,
  authorize('admin', 'superadmin'),
  simulateRandomCustomerOrder
);

// Superadmin Routes
router.get('/super/restaurants', protect, authorize('superadmin'), listAllRestaurants);
router.post('/super/restaurants', protect, authorize('superadmin'), createRestaurantWithAdmin);
router.patch(
  '/super/restaurants/:id/toggle-status',
  protect,
  authorize('superadmin'),
  toggleRestaurantStatus
);

export default router;
