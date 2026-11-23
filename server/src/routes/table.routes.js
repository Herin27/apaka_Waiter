import { Router } from 'express';
import {
  listTables,
  createTable,
  updateTable,
  deleteTable,
  rotateTableQrToken,
  updateTableLayout,
  transferTable,
  mergeTables,
  getTableQrPng,
  getAllTablesQrSheetPdf,
} from '../controllers/table.controller.js';
import { protect, authorize, branchScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createTableSchema,
  updateTableSchema,
  updateTableLayoutSchema,
  transferTableSchema,
  mergeTablesSchema,
  idParamSchema,
} from '../utils/validators.js';

const router = Router();

router.use(protect, branchScope);

router.get('/', listTables);
router.get('/qr-sheet', authorize('admin', 'superadmin', 'waiter', 'cashier'), getAllTablesQrSheetPdf);
router.get('/:id/qr', validate(idParamSchema), getTableQrPng);

// Waiter / Cashier / Admin table transfer & merge
router.post(
  '/:id/transfer',
  authorize('waiter', 'cashier', 'admin', 'superadmin'),
  validate(transferTableSchema),
  transferTable
);
router.post(
  '/merge',
  authorize('waiter', 'cashier', 'admin', 'superadmin'),
  validate(mergeTablesSchema),
  mergeTables
);

// Admin table management
router.patch('/layout', authorize('admin', 'superadmin'), validate(updateTableLayoutSchema), updateTableLayout);
router.post('/', authorize('admin', 'superadmin'), validate(createTableSchema), createTable);
router.patch('/:id', authorize('admin', 'superadmin'), validate(updateTableSchema), updateTable);
router.post('/:id/rotate-qr', authorize('admin', 'superadmin'), validate(idParamSchema), rotateTableQrToken);
router.delete('/:id', authorize('admin', 'superadmin'), validate(idParamSchema), deleteTable);

export default router;
