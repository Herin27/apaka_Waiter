import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  let token = null;

  if (req.cookies && req.cookies.aw_token) {
    token = req.cookies.aw_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Authentication required. Please log in.'));
  }

  const decoded = jwt.verify(token, env.JWT_SECRET);

  const user = await User.findById(decoded.sub);
  if (!user) {
    return next(new ApiError(401, 'User account no longer exists.'));
  }

  if (!user.isActive) {
    return next(new ApiError(403, 'Your account has been deactivated. Contact an administrator.'));
  }

  req.user = user;
  next();
});

export const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied. Role '${req.user.role}' is not authorized for this resource.`)
      );
    }

    next();
  };
};

export const branchScope = (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required.'));
  }

  if (req.user.role === 'superadmin') {
    req.scopeFilter = {};
    if (req.query.restaurantId) req.scopeFilter.restaurantId = req.query.restaurantId;
    if (req.query.branchId) req.scopeFilter.branchId = req.query.branchId;
    return next();
  }

  if (!req.user.restaurantId) {
    return next(new ApiError(403, 'User is not associated with any restaurant.'));
  }

  req.scopeFilter = {
    restaurantId: req.user.restaurantId,
    ...(req.user.branchId ? { branchId: req.user.branchId } : {}),
  };

  const requestedBranchId = req.params.branchId || req.body?.branchId || req.query?.branchId;
  if (
    requestedBranchId &&
    req.user.branchId &&
    String(requestedBranchId) !== String(req.user.branchId)
  ) {
    return next(new ApiError(403, 'Access denied outside your assigned branch.'));
  }

  const requestedRestaurantId =
    req.params.restaurantId || req.body?.restaurantId || req.query?.restaurantId;
  if (
    requestedRestaurantId &&
    String(requestedRestaurantId) !== String(req.user.restaurantId)
  ) {
    return next(new ApiError(403, 'Access denied outside your assigned restaurant.'));
  }

  next();
};
