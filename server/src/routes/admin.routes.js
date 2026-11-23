import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  listActivityLogs,
} from '../controllers/admin.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin', 'superadmin'), branchScope);

router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.get('/activity-logs', listActivityLogs);

export default router;
