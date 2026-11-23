import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../services/activityLog.service.js';

const signToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      restaurantId: user.restaurantId?.toString() || null,
      branchId: user.branchId?.toString() || null,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

const sanitizeUser = (user) => ({
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
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const invalidMsg = 'Invalid email or password.';

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    return next(new ApiError(401, invalidMsg));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new ApiError(401, invalidMsg));
  }

  if (!user.isActive) {
    return next(new ApiError(401, invalidMsg));
  }

  const token = signToken(user);

  await logActivity({
    branchId: user.branchId,
    userId: user._id,
    actorRole: user.role,
    action: 'AUTH_LOGIN',
    entityType: 'User',
    entityId: user._id,
    details: { email: user.email, ip: req.ip },
  });

  res
    .cookie('aw_token', token, cookieOptions())
    .status(200)
    .json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
});

export const logout = asyncHandler(async (_req, res) => {
  res
    .clearCookie('aw_token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    })
    .status(200)
    .json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('restaurantId', 'name currency settings')
    .populate('branchId', 'name slug address timezone');

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        assignedTables: user.assignedTables,
        restaurant: user.restaurantId,
        branch: user.branchId,
      },
    },
  });
});

export const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return next(new ApiError(400, 'Current password is incorrect.'));
  }

  if (currentPassword === newPassword) {
    return next(new ApiError(400, 'New password must be different from the current password.'));
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  await logActivity({
    branchId: user.branchId,
    userId: user._id,
    actorRole: user.role,
    action: 'AUTH_CHANGE_PASSWORD',
    entityType: 'User',
    entityId: user._id,
    details: { email: user.email },
  });

  const token = signToken(user);

  res
    .cookie('aw_token', token, cookieOptions())
    .status(200)
    .json({
      success: true,
      data: {
        message: 'Password updated successfully.',
        token,
      },
    });
});
