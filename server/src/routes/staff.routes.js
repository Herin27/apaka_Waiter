import { Router } from 'express';
import {
  listStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
} from '../controllers/staff.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createStaffSchema,
  updateStaffSchema,
  staffIdParamSchema,
} from '../utils/validators.js';

const router = Router();

router.use(protect, authorize('admin', 'superadmin'), branchScope);

router.get('/', listStaff);
router.post('/', validate(createStaffSchema), createStaff);
router.patch('/:id', validate(updateStaffSchema), updateStaff);
router.delete('/:id', validate(staffIdParamSchema), deactivateStaff);

export default router;
