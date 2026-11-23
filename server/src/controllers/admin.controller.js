import { ActivityLog, Branch, Restaurant } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../services/activityLog.service.js';

const getBranchFilter = (req) => {
  if (req.user.role === 'superadmin') {
    return req.query.branchId ? { branchId: req.query.branchId } : {};
  }
  return { branchId: req.user.branchId };
};

// GET /api/v1/settings
export const getSettings = asyncHandler(async (req, res, next) => {
  const branchId = req.query.branchId || req.user.branchId;
  const branch = await Branch.findById(branchId);
  if (!branch) return next(new ApiError(404, 'Branch not found.'));

  const restaurant = await Restaurant.findById(branch.restaurantId);
  if (!restaurant) return next(new ApiError(404, 'Restaurant not found.'));

  res.status(200).json({
    success: true,
    data: {
      restaurant,
      branch,
    },
  });
});

// PATCH /api/v1/settings
export const updateSettings = asyncHandler(async (req, res, next) => {
  const branchId = req.body.branchId || req.user.branchId;
  const branch = await Branch.findById(branchId);
  if (!branch) return next(new ApiError(404, 'Branch not found.'));

  const restaurant = await Restaurant.findById(branch.restaurantId);
  if (!restaurant) return next(new ApiError(404, 'Restaurant not found.'));

  const {
    restaurantName,
    logo,
    gstin,
    fssai,
    currency,
    taxPercent,
    serviceChargePercent,
    autoConfirmSeconds,
    receiptFooter,
    geofence,
    languages,
    branchName,
    address,
    openingHours,
  } = req.body;

  if (restaurantName !== undefined) restaurant.name = restaurantName;
  if (logo !== undefined) restaurant.logo = logo;
  if (gstin !== undefined) restaurant.gstin = gstin;
  if (fssai !== undefined) restaurant.fssai = fssai;
  if (currency !== undefined) restaurant.currency = currency;

  if (taxPercent !== undefined) restaurant.settings.taxPercent = Number(taxPercent);
  if (serviceChargePercent !== undefined)
    restaurant.settings.serviceChargePercent = Number(serviceChargePercent);
  if (autoConfirmSeconds !== undefined)
    restaurant.settings.autoConfirmSeconds = Number(autoConfirmSeconds);
  if (receiptFooter !== undefined) restaurant.settings.receiptFooter = receiptFooter;
  if (Array.isArray(languages) && languages.length > 0) {
    restaurant.settings.languages = languages;
  }
  if (geofence) {
    restaurant.settings.geofence = {
      ...restaurant.settings.geofence.toObject(),
      ...geofence,
    };
  }

  if (branchName !== undefined) branch.name = branchName;
  if (address !== undefined) branch.address = address;
  if (openingHours) {
    branch.openingHours = {
      ...branch.openingHours.toObject(),
      ...openingHours,
    };
  }

  await Promise.all([restaurant.save(), branch.save()]);

  await logActivity({
    branchId: branch._id,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'SETTINGS_UPDATED',
    entityType: 'Restaurant',
    entityId: restaurant._id,
    details: { restaurantName: restaurant.name, branchName: branch.name },
  });

  res.status(200).json({
    success: true,
    data: {
      message: 'Settings updated successfully.',
      restaurant,
      branch,
    },
  });
});

// GET /api/v1/activity-logs?action=&actorRole=&search=&page=1&limit=25
export const listActivityLogs = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);

  if (req.query.action) {
    filter.action = new RegExp(String(req.query.action).trim(), 'i');
  }
  if (req.query.actorRole) {
    filter.actorRole = String(req.query.actorRole).trim();
  }
  if (req.query.entityType) {
    filter.entityType = new RegExp(String(req.query.entityType).trim(), 'i');
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ActivityLog.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});
