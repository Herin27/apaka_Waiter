import { Router } from 'express';
import {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  uploadMenuItemImage,
  importMenuCsv,
  exportMenuCsv,
} from '../controllers/menuItem.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { uploadImage, uploadCsv } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  toggleAvailabilitySchema,
  idParamSchema,
} from '../utils/validators.js';

const router = Router();

router.use(protect, branchScope);

router.get('/', listMenuItems);
router.get('/export/csv', authorize('admin', 'superadmin'), exportMenuCsv);

router.post(
  '/upload-image',
  authorize('admin', 'superadmin'),
  uploadImage.single('image'),
  uploadMenuItemImage
);
router.post(
  '/import/csv',
  authorize('admin', 'superadmin'),
  uploadCsv.single('file'),
  importMenuCsv
);

router.patch(
  '/:id/availability',
  authorize('admin', 'kitchen', 'superadmin'),
  validate(toggleAvailabilitySchema),
  toggleAvailability
);

router.post('/', authorize('admin', 'superadmin'), validate(createMenuItemSchema), createMenuItem);
router.patch('/:id', authorize('admin', 'superadmin'), validate(updateMenuItemSchema), updateMenuItem);
router.delete('/:id', authorize('admin', 'superadmin'), validate(idParamSchema), deleteMenuItem);

export default router;
