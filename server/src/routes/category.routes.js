import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../controllers/category.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  idParamSchema,
} from '../utils/validators.js';

const router = Router();

router.use(protect, branchScope);

router.get('/', listCategories);
router.patch('/reorder', authorize('admin', 'superadmin'), validate(reorderCategoriesSchema), reorderCategories);
router.post('/', authorize('admin', 'superadmin'), validate(createCategorySchema), createCategory);
router.patch('/:id', authorize('admin', 'superadmin'), validate(updateCategorySchema), updateCategory);
router.delete('/:id', authorize('admin', 'superadmin'), validate(idParamSchema), deleteCategory);

export default router;
