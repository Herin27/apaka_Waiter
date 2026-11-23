import { Category, MenuItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../services/activityLog.service.js';

const getBranchFilter = (req) => {
  if (req.user.role === 'superadmin') {
    return req.query.branchId ? { branchId: req.query.branchId } : {};
  }
  return { branchId: req.user.branchId };
};

export const listCategories = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const categories = await Category.find(filter).sort({ sortOrder: 1, createdAt: 1 });

  res.status(200).json({
    success: true,
    data: {
      count: categories.length,
      categories,
    },
  });
});

export const createCategory = asyncHandler(async (req, res, next) => {
  const branchId =
    req.user.role === 'superadmin' ? req.body.branchId || req.user.branchId : req.user.branchId;

  if (!branchId) {
    return next(new ApiError(400, 'branchId is required.'));
  }

  const category = await Category.create({
    branchId,
    name: req.body.name,
    sortOrder: req.body.sortOrder,
    station: req.body.station,
    isActive: req.body.isActive,
  });

  await logActivity({
    branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'CATEGORY_CREATED',
    entityType: 'Category',
    entityId: category._id,
    details: { name: category.name.en, station: category.station },
  });

  res.status(201).json({
    success: true,
    data: { category },
  });
});

export const updateCategory = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const category = await Category.findOne(filter);

  if (!category) {
    return next(new ApiError(404, 'Category not found.'));
  }

  if (req.body.name) {
    category.name = { ...category.name.toObject(), ...req.body.name };
  }
  if (req.body.sortOrder !== undefined) category.sortOrder = req.body.sortOrder;
  if (req.body.station !== undefined) category.station = req.body.station;
  if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

  await category.save();

  await logActivity({
    branchId: category.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'CATEGORY_UPDATED',
    entityType: 'Category',
    entityId: category._id,
    details: { name: category.name.en },
  });

  res.status(200).json({
    success: true,
    data: { category },
  });
});

export const deleteCategory = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const category = await Category.findOne(filter);

  if (!category) {
    return next(new ApiError(404, 'Category not found.'));
  }

  const linkedItemsCount = await MenuItem.countDocuments({ categoryId: category._id });
  if (linkedItemsCount > 0) {
    return next(
      new ApiError(
        400,
        `Cannot delete category with ${linkedItemsCount} linked menu items. Reassign or delete those items first.`
      )
    );
  }

  await category.deleteOne();

  await logActivity({
    branchId: category.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'CATEGORY_DELETED',
    entityType: 'Category',
    entityId: category._id,
    details: { name: category.name.en },
  });

  res.status(200).json({
    success: true,
    data: { message: 'Category deleted successfully.' },
  });
});

export const reorderCategories = asyncHandler(async (req, res) => {
  const branchFilter = getBranchFilter(req);
  const { items } = req.body;

  const bulkOps = items.map((entry) => ({
    updateOne: {
      filter: { _id: entry.id, ...branchFilter },
      update: { $set: { sortOrder: entry.sortOrder } },
    },
  }));

  await Category.bulkWrite(bulkOps);

  const categories = await Category.find(branchFilter).sort({ sortOrder: 1, createdAt: 1 });

  res.status(200).json({
    success: true,
    data: {
      message: 'Categories reordered successfully.',
      categories,
    },
  });
});
