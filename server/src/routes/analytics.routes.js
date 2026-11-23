import { Router } from 'express';
import {
  getAnalyticsDashboard,
  listIngredients,
  createIngredient,
  adjustIngredientStock,
  deleteIngredient,
  updateMenuItemRecipe,
  listCustomers,
  listFeedbacks,
  replyToFeedback,
  getWebPushConfig,
  subscribeWebPush,
} from '../controllers/analytics.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

router.use(protect, branchScope);

// Analytics
router.get('/analytics', authorize('admin', 'superadmin'), getAnalyticsDashboard);

// Inventory & Recipes
router.get('/inventory', authorize('admin', 'kitchen', 'superadmin'), listIngredients);
router.post('/inventory', authorize('admin', 'superadmin'), createIngredient);
router.patch('/inventory/:id/adjust', authorize('admin', 'kitchen', 'superadmin'), adjustIngredientStock);
router.delete('/inventory/:id', authorize('admin', 'superadmin'), deleteIngredient);
router.patch('/inventory/recipe/:menuItemId', authorize('admin', 'superadmin'), updateMenuItemRecipe);

// Customers / Loyalty
router.get('/customers', authorize('admin', 'cashier', 'superadmin'), listCustomers);

// Feedback Management
router.get('/feedback', authorize('admin', 'superadmin'), listFeedbacks);
router.patch('/feedback/:id/reply', authorize('admin', 'superadmin'), replyToFeedback);

// Web Push Subscriptions
router.get('/push/vapid-public-key', getWebPushConfig);
router.post('/push/subscribe', subscribeWebPush);

export default router;
