import { Router } from 'express';
import {
  parseCustomerVoiceOrder,
  getCustomerRecommendations,
  getLiveWaitTimePrediction,
  getDemandForecast,
  getLatestDailySummary,
  triggerDailySummaryNow,
} from '../controllers/ai.controller.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { requireCustomerSession } from '../middleware/sessionAuth.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

// Customer Public AI Routes (session-authenticated + AI rate limiter)
router.post('/public/ai/parse-order', aiLimiter, requireCustomerSession, parseCustomerVoiceOrder);
router.get('/public/ai/recommendations', aiLimiter, requireCustomerSession, getCustomerRecommendations);
router.get('/public/ai/wait-time', requireCustomerSession, getLiveWaitTimePrediction);

// Admin AI Insights Routes
router.get(
  '/analytics/demand-forecast',
  aiLimiter,
  protect,
  authorize('admin', 'superadmin'),
  branchScope,
  getDemandForecast
);
router.get(
  '/admin/daily-summary',
  protect,
  authorize('admin', 'superadmin'),
  branchScope,
  getLatestDailySummary
);
router.post(
  '/admin/daily-summary/generate',
  aiLimiter,
  protect,
  authorize('admin', 'superadmin'),
  branchScope,
  triggerDailySummaryNow
);

export default router;
