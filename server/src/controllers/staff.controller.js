import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../services/activityLog.service.js';

const formatStaff = (user) => ({
  id: user._id,
  restaurantId: user.restaurantId,
  branchId: user.branchId,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isActive: user.isActive,
  assignedTables: user.assignedTables,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const listStaff = asyncHandler(async (req, res) => {
  const filter = { ...req.scopeFilter };

  if (req.query.role) {
    filter.role = req.query.role;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const staff = await User.find(filter)
    .populate('assignedTables', 'name section')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      count: staff.length,
      staff: staff.map(formatStaff),
    },
  });
});

export const createStaff = asyncHandler(async (req, res, next) => {
  const { name, email, phone, password, role, branchId, assignedTables } = req.body;

  if (role === 'superadmin' && req.user.role !== 'superadmin') {
    return next(new ApiError(403, 'Admins are not permitted to create superadmin accounts.'));
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return next(new ApiError(409, 'A staff member with this email already exists.'));
  }

  const targetBranchId =
    req.user.role === 'superadmin' ? branchId || req.user.branchId : req.user.branchId;

  if (!targetBranchId && role !== 'superadmin') {
    return next(new ApiError(400, 'branchId is required for branch staff.'));
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newStaff = await User.create({
    restaurantId: req.user.restaurantId,
    branchId: targetBranchId,
    name,
    email,
    phone,
    passwordHash,
    role,
    isActive: true,
    assignedTables,
  });

  await logActivity({
    branchId: targetBranchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'STAFF_CREATED',
    entityType: 'User',
    entityId: newStaff._id,
    details: { createdEmail: newStaff.email, role: newStaff.role },
  });

  res.status(201).json({
    success: true,
    data: {
      staff: formatStaff(newStaff),
    },
  });
});

export const updateStaff = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, phone, password, role, isActive, assignedTables } = req.body;

  if (role === 'superadmin' && req.user.role !== 'superadmin') {
    return next(new ApiError(403, 'Admins are not permitted to assign the superadmin role.'));
  }

  const staffMember = await User.findOne({ _id: id, ...req.scopeFilter });
  if (!staffMember) {
    return next(new ApiError(404, 'Staff member not found in your branch.'));
  }

  if (staffMember.role === 'superadmin' && req.user.role !== 'superadmin') {
    return next(new ApiError(403, 'Cannot modify a superadmin account.'));
  }

  if (String(staffMember._id) === String(req.user._id) && isActive === false) {
    return next(new ApiError(400, 'You cannot deactivate your own account.'));
  }

  const changedFields = [];

  if (name !== undefined) {
    staffMember.name = name;
    changedFields.push('name');
  }
  if (phone !== undefined) {
    staffMember.phone = phone;
    changedFields.push('phone');
  }
  if (role !== undefined) {
    staffMember.role = role;
    changedFields.push('role');
  }
  if (isActive !== undefined) {
    staffMember.isActive = isActive;
    changedFields.push('isActive');
  }
  if (assignedTables !== undefined) {
    staffMember.assignedTables = assignedTables;
    changedFields.push('assignedTables');
  }
  if (password !== undefined) {
    staffMember.passwordHash = await bcrypt.hash(password, 10);
    changedFields.push('password');
  }

  await staffMember.save();

  await logActivity({
    branchId: staffMember.branchId || req.user.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'STAFF_UPDATED',
    entityType: 'User',
    entityId: staffMember._id,
    details: { targetEmail: staffMember.email, changedFields },
  });

  res.status(200).json({
    success: true,
    data: {
      staff: formatStaff(staffMember),
    },
  });
});

export const deactivateStaff = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (String(id) === String(req.user._id)) {
    return next(new ApiError(400, 'You cannot deactivate your own account.'));
  }

  const staffMember = await User.findOne({ _id: id, ...req.scopeFilter });
  if (!staffMember) {
    return next(new ApiError(404, 'Staff member not found in your branch.'));
  }

  if (staffMember.role === 'superadmin' && req.user.role !== 'superadmin') {
    return next(new ApiError(403, 'Cannot deactivate a superadmin account.'));
  }

  staffMember.isActive = false;
  await staffMember.save();

  await logActivity({
    branchId: staffMember.branchId || req.user.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'STAFF_DEACTIVATED',
    entityType: 'User',
    entityId: staffMember._id,
    details: { targetEmail: staffMember.email },
  });

  res.status(200).json({
    success: true,
    data: {
      message: 'Staff member deactivated successfully.',
      staff: formatStaff(staffMember),
    },
  });
});
