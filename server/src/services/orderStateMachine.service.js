import { ApiError } from '../utils/ApiError.js';

const TRANSITIONS = {
  PLACED: {
    CONFIRMED: ['waiter', 'admin', 'superadmin', 'SYSTEM'],
    REJECTED: ['waiter', 'admin', 'superadmin'],
    CANCELLED: ['waiter', 'admin', 'superadmin', 'CUSTOMER'],
  },
  CONFIRMED: {
    PREPARING: ['kitchen', 'admin', 'superadmin'],
    CANCELLED: ['waiter', 'admin', 'superadmin', 'CUSTOMER'],
  },
  PREPARING: {
    READY: ['kitchen', 'admin', 'superadmin'],
  },
  READY: {
    SERVED: ['waiter', 'admin', 'superadmin'],
  },
  SERVED: {
    PAID: ['cashier', 'waiter', 'admin', 'superadmin'],
  },
  PAID: {},
  REJECTED: {},
  CANCELLED: {},
};

export const assertValidOrderTransition = ({ currentStatus, nextStatus, actorRole }) => {
  const allowedNext = TRANSITIONS[currentStatus];
  if (!allowedNext) {
    throw new ApiError(400, `Unknown current order status: ${currentStatus}`);
  }

  const allowedRoles = allowedNext[nextStatus];
  if (!allowedRoles) {
    if (nextStatus === 'CANCELLED' && !['PLACED', 'CONFIRMED'].includes(currentStatus)) {
      throw new ApiError(
        400,
        `Cannot cancel order once it has reached '${currentStatus}'. Cancellation is only allowed before PREPARING.`
      );
    }
    throw new ApiError(
      400,
      `Invalid order transition from '${currentStatus}' to '${nextStatus}'.`
    );
  }

  if (!allowedRoles.includes(actorRole)) {
    throw new ApiError(
      403,
      `Role '${actorRole}' is not permitted to move an order from '${currentStatus}' to '${nextStatus}'.`
    );
  }
};

export const mapOrderStatusToTableStatus = (orderStatus) => {
  switch (orderStatus) {
    case 'PLACED':
    case 'CONFIRMED':
      return 'WAITING';
    case 'PREPARING':
      return 'PREPARING';
    case 'READY':
      return 'READY';
    case 'SERVED':
      return 'SEATED';
    default:
      return null;
  }
};
