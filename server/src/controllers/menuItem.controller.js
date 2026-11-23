import { parse } from 'csv-parse/sync';
import { Category, MenuItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../services/activityLog.service.js';
import { emitToBranch } from '../sockets/emitter.js';

const getBranchFilter = (req) => {
  if (req.user.role === 'superadmin') {
    return req.query.branchId ? { branchId: req.query.branchId } : {};
  }
  return { branchId: req.user.branchId };
};

export const listMenuItems = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);

  if (req.query.category) filter.categoryId = req.query.category;
  if (req.query.isVeg !== undefined) filter.isVeg = req.query.isVeg === 'true';
  if (req.query.isVegan !== undefined) filter.isVegan = req.query.isVegan === 'true';
  if (req.query.isJain !== undefined) filter.isJain = req.query.isJain === 'true';
  if (req.query.isAvailable !== undefined) filter.isAvailable = req.query.isAvailable === 'true';

  if (req.query.spiceLevel !== undefined) {
    filter.spiceLevel = Number(req.query.spiceLevel);
  }

  if (req.query.excludeAllergens) {
    const excluded = String(req.query.excludeAllergens)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (excluded.length > 0) {
      filter.allergens = {
        $nin: excluded.map((a) => new RegExp(`^${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')),
      };
    }
  }

  if (req.query.search) {
    const regex = new RegExp(String(req.query.search).trim(), 'i');
    filter.$or = [
      { 'name.en': regex },
      { 'name.hi': regex },
      { 'name.gu': regex },
      { 'description.en': regex },
      { tags: regex },
    ];
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .populate('categoryId', 'name station sortOrder')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MenuItem.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

export const createMenuItem = asyncHandler(async (req, res, next) => {
  const branchId =
    req.user.role === 'superadmin' ? req.body.branchId || req.user.branchId : req.user.branchId;

  if (!branchId) {
    return next(new ApiError(400, 'branchId is required.'));
  }

  const category = await Category.findOne({ _id: req.body.categoryId, branchId });
  if (!category) {
    return next(new ApiError(404, 'Category not found in this branch.'));
  }

  const item = await MenuItem.create({
    ...req.body,
    branchId,
  });

  await logActivity({
    branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'MENU_ITEM_CREATED',
    entityType: 'MenuItem',
    entityId: item._id,
    details: { name: item.name.en, price: item.price },
  });

  res.status(201).json({
    success: true,
    data: { item },
  });
});

export const updateMenuItem = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const item = await MenuItem.findOne(filter);

  if (!item) {
    return next(new ApiError(404, 'Menu item not found.'));
  }

  if (req.body.categoryId) {
    const category = await Category.findOne({ _id: req.body.categoryId, branchId: item.branchId });
    if (!category) {
      return next(new ApiError(404, 'Target category not found in this branch.'));
    }
    item.categoryId = req.body.categoryId;
  }

  if (req.body.name) item.name = { ...item.name.toObject(), ...req.body.name };
  if (req.body.description) item.description = { ...item.description.toObject(), ...req.body.description };

  const directFields = [
    'price',
    'image',
    'isVeg',
    'isVegan',
    'isJain',
    'spiceLevel',
    'allergens',
    'prepTimeMin',
    'variants',
    'addons',
    'isAvailable',
    'isBestseller',
    'tags',
  ];

  for (const field of directFields) {
    if (req.body[field] !== undefined) {
      item[field] = req.body[field];
    }
  }

  await item.save();

  await logActivity({
    branchId: item.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'MENU_ITEM_UPDATED',
    entityType: 'MenuItem',
    entityId: item._id,
    details: { name: item.name.en },
  });

  res.status(200).json({
    success: true,
    data: { item },
  });
});

export const deleteMenuItem = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const item = await MenuItem.findOne(filter);

  if (!item) {
    return next(new ApiError(404, 'Menu item not found.'));
  }

  await item.deleteOne();

  await logActivity({
    branchId: item.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'MENU_ITEM_DELETED',
    entityType: 'MenuItem',
    entityId: item._id,
    details: { name: item.name.en },
  });

  res.status(200).json({
    success: true,
    data: { message: 'Menu item deleted successfully.' },
  });
});

export const toggleAvailability = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id, ...getBranchFilter(req) };
  const item = await MenuItem.findOne(filter);

  if (!item) {
    return next(new ApiError(404, 'Menu item not found.'));
  }

  item.isAvailable =
    typeof req.body.isAvailable === 'boolean' ? req.body.isAvailable : !item.isAvailable;

  await item.save();

  emitToBranch(item.branchId, 'menu:availability', {
    itemId: item._id.toString(),
    isAvailable: item.isAvailable,
  });

  await logActivity({
    branchId: item.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'MENU_ITEM_AVAILABILITY_TOGGLED',
    entityType: 'MenuItem',
    entityId: item._id,
    details: { name: item.name.en, isAvailable: item.isAvailable },
  });

  res.status(200).json({
    success: true,
    data: {
      itemId: item._id,
      isAvailable: item.isAvailable,
      item,
    },
  });
});

export const uploadMenuItemImage = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'Please upload an image file (JPG, PNG, or WEBP, max 3MB).'));
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const relativePath = `/uploads/${req.file.filename}`;

  res.status(201).json({
    success: true,
    data: {
      filename: req.file.filename,
      path: relativePath,
      url: `${baseUrl}${relativePath}`,
    },
  });
});

const parseBool = (val, fallback = false) => {
  if (val === undefined || val === null || val === '') return fallback;
  return ['true', '1', 'yes', 'y'].includes(String(val).trim().toLowerCase());
};

export const importMenuCsv = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'CSV file is required (field name: "file").'));
  }

  const branchId =
    req.user.role === 'superadmin' ? req.body.branchId || req.user.branchId : req.user.branchId;

  if (!branchId) {
    return next(new ApiError(400, 'branchId is required.'));
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return next(new ApiError(400, `Failed to parse CSV: ${err.message}`));
  }

  if (!records.length) {
    return next(new ApiError(400, 'CSV file contains no rows.'));
  }

  const existingCategories = await Category.find({ branchId });
  const catMap = new Map(existingCategories.map((c) => [c.name.en.toLowerCase(), c]));

  const docsToInsert = [];
  const errors = [];

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    const rowNum = idx + 2;

    const nameEn = row.name_en || row.name;
    const categoryName = row.category || 'General';
    const price = Number(row.price);

    if (!nameEn || Number.isNaN(price) || price < 0) {
      errors.push({ row: rowNum, message: 'Missing valid name_en or numeric price' });
      continue;
    }

    let category = catMap.get(categoryName.toLowerCase());
    if (!category) {
      category = await Category.create({
        branchId,
        name: { en: categoryName, hi: '', gu: '' },
        sortOrder: catMap.size + 1,
        station: ['KITCHEN', 'BAR', 'PASTRY'].includes(String(row.station || '').toUpperCase())
          ? String(row.station).toUpperCase()
          : 'KITCHEN',
      });
      catMap.set(categoryName.toLowerCase(), category);
    }

    docsToInsert.push({
      branchId,
      categoryId: category._id,
      name: {
        en: nameEn,
        hi: row.name_hi || '',
        gu: row.name_gu || '',
      },
      description: {
        en: row.description_en || row.description || '',
        hi: row.description_hi || '',
        gu: row.description_gu || '',
      },
      price,
      isVeg: parseBool(row.isVeg, true),
      isVegan: parseBool(row.isVegan, false),
      isJain: parseBool(row.isJain, false),
      spiceLevel: Math.min(3, Math.max(0, parseInt(row.spiceLevel, 10) || 0)),
      allergens: row.allergens
        ? String(row.allergens)
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      prepTimeMin: Math.max(1, parseInt(row.prepTimeMin, 10) || 12),
      isAvailable: parseBool(row.isAvailable, true),
      isBestseller: parseBool(row.isBestseller, false),
      tags: row.tags
        ? String(row.tags)
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });
  }

  const inserted = docsToInsert.length ? await MenuItem.insertMany(docsToInsert) : [];

  await logActivity({
    branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'MENU_CSV_IMPORTED',
    entityType: 'MenuItem',
    details: { importedCount: inserted.length, errorCount: errors.length },
  });

  res.status(200).json({
    success: true,
    data: {
      importedCount: inserted.length,
      failedCount: errors.length,
      errors,
    },
  });
});

const escapeCsv = (value) => {
  const str = value === undefined || value === null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportMenuCsv = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);
  const items = await MenuItem.find(filter)
    .populate('categoryId', 'name station')
    .sort({ createdAt: 1 });

  const headers = [
    'category',
    'station',
    'name_en',
    'name_hi',
    'name_gu',
    'description_en',
    'price',
    'isVeg',
    'isVegan',
    'isJain',
    'spiceLevel',
    'allergens',
    'prepTimeMin',
    'isAvailable',
    'isBestseller',
    'tags',
  ];

  const rows = items.map((item) =>
    [
      item.categoryId?.name?.en || '',
      item.categoryId?.station || 'KITCHEN',
      item.name?.en || '',
      item.name?.hi || '',
      item.name?.gu || '',
      item.description?.en || '',
      item.price,
      item.isVeg,
      item.isVegan,
      item.isJain,
      item.spiceLevel,
      (item.allergens || []).join('|'),
      item.prepTimeMin,
      item.isAvailable,
      item.isBestseller,
      (item.tags || []).join('|'),
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="aapka-waiter-menu.csv"');
  res.status(200).send(csvContent);
});
