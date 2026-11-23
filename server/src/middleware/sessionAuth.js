import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TableSession } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireCustomerSession = asyncHandler(async (req, _res, next) => {
  let token = null;

  if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']);
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.aw_session_token) {
    token = req.cookies.aw_session_token;
  }

  if (!token) {
    return next(new ApiError(401, 'Session token is required. Please scan the table QR code.'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(new ApiError(401, 'Invalid or expired table session token.'));
  }

  if (decoded.type !== 'CUSTOMER_SESSION' || !decoded.sessionId) {
    return next(new ApiError(401, 'Invalid session token payload.'));
  }

  const session = await TableSession.findById(decoded.sessionId);
  if (!session || session.status !== 'OPEN') {
    return next(new ApiError(403, 'This table session is closed. Please scan the QR code again.'));
  }

  const guest = session.guests.find((g) => g.id === decoded.guestId) || {
    id: decoded.guestId || 'guest_unknown',
    nickname: decoded.nickname || 'Guest',
  };

  req.session = session;
  req.guest = guest;
  next();
});
