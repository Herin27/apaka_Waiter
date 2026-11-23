import {
  Branch,
  MenuItem,
  Order,
  Restaurant,
  Table,
  TableSession,
  WaiterCall,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateOrderNo } from '../utils/generateOrderNo.js';
import { logActivity } from '../services/activityLog.service.js';
import {
  assertValidOrderTransition,
  mapOrderStatusToTableStatus,
} from '../services/orderStateMachine.service.js';
import { emitToBranch, emitToSession } from '../sockets/index.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const getBranchFilter = (req) => {
  if (req.user.role === 'superadmin') {
    return req.query.branchId ? { branchId: req.query.branchId } : {};
  }
  return { branchId: req.user.branchId };
};

const syncTableAfterOrderChange = async (order) => {
  const mappedStatus = mapOrderStatusToTableStatus(order.status);
  if (!mappedStatus) return;

  const table = await Table.findByIdAndUpdate(
    order.tableId,
    { status: mappedStatus },
    { new: true }
  );

  if (table) {
    emitToBranch(order.branchId, 'table:updated', { table });
  }
};

// GET /api/v1/orders?status=&tableId=&date=YYYY-MM-DD
export const listOrders = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);

  if (req.query.status) {
    const statuses = String(req.query.status)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }

  if (req.query.tableId) {
    filter.tableId = req.query.tableId;
  }

  if (req.query.date) {
    const start = new Date(`${req.query.date}T00:00:00.000Z`);
    const end = new Date(`${req.query.date}T23:59:59.999Z`);
    if (!Number.isNaN(start.getTime())) {
      filter.createdAt = { $gte: start, $lte: end };
    }
  }

  const orders = await Order.find(filter)
    .populate('tableId', 'name section')
    .sort({ createdAt: -1 })
    .limit(200);

  res.status(200).json({
    success: true,
    data: {
      count: orders.length,
      orders,
    },
  });
});

// POST /api/v1/orders (waiter places order on behalf of customer)
export const waiterPlaceOrder = asyncHandler(async (req, res, next) => {
  const { tableId, idempotencyKey, items } = req.body;
  const branchFilter = getBranchFilter(req);

  const table = await Table.findOne({ _id: tableId, ...branchFilter });
  if (!table) {
    return next(new ApiError(404, 'Table not found in your branch.'));
  }

  let session = await TableSession.findOne({
    branchId: table.branchId,
    status: 'OPEN',
    $or: [{ tableId: table._id }, { mergedTableIds: table._id }],
  });

  if (!session) {
    session = await TableSession.create({
      branchId: table.branchId,
      tableId: table._id,
      status: 'OPEN',
      guests: [{ id: `staff_${req.user._id}`, nickname: `Waiter (${req.user.name})` }],
      cart: [],
    });
  }

  const existingOrder = await Order.findOne({ sessionId: session._id, idempotencyKey });
  if (existingOrder) {
    return res.status(200).json({
      success: true,
      data: { order: existingOrder, idempotentReplay: true },
    });
  }

  const branch = await Branch.findById(table.branchId);
  const restaurant = await Restaurant.findById(branch.restaurantId);

  const dbItems = await MenuItem.find({
    _id: { $in: items.map((i) => i.menuItemId) },
    branchId: table.branchId,
  }).populate('categoryId', 'station');

  const dbItemMap = new Map(dbItems.map((i) => [String(i._id), i]));

  const orderItems = [];
  let subtotal = 0;

  for (const entry of items) {
    const dbItem = dbItemMap.get(String(entry.menuItemId));
    if (!dbItem) {
      return next(new ApiError(404, `Menu item ${entry.menuItemId} not found.`));
    }
    if (!dbItem.isAvailable) {
      return next(new ApiError(400, `'${dbItem.name.en}' is currently unavailable.`));
    }

    let unitPrice = dbItem.price;
    let variantSnapshot = undefined;

    if (entry.variantName) {
      const foundVariant = (dbItem.variants || []).find(
        (v) => v.name.toLowerCase() === entry.variantName.toLowerCase()
      );
      if (!foundVariant) {
        return next(new ApiError(400, `Invalid variant '${entry.variantName}' for ${dbItem.name.en}.`));
      }
      unitPrice = foundVariant.price;
      variantSnapshot = { name: foundVariant.name, price: foundVariant.price };
    }

    const addonsSnapshot = [];
    if (entry.addonNames && entry.addonNames.length > 0) {
      for (const aName of entry.addonNames) {
        const foundAddon = (dbItem.addons || []).find(
          (a) => a.name.toLowerCase() === aName.toLowerCase()
        );
        if (!foundAddon) {
          return next(new ApiError(400, `Invalid addon '${aName}' for ${dbItem.name.en}.`));
        }
        unitPrice += foundAddon.price;
        addonsSnapshot.push({ name: foundAddon.name, price: foundAddon.price });
      }
    }

    unitPrice = round2(unitPrice);
    subtotal += unitPrice * entry.qty;

    orderItems.push({
      menuItemId: dbItem._id,
      name: dbItem.name.en,
      price: unitPrice,
      qty: entry.qty,
      ...(variantSnapshot ? { variant: variantSnapshot } : {}),
      addons: addonsSnapshot,
      note: entry.note || '',
      station: dbItem.categoryId?.station || 'KITCHEN',
      status: 'CONFIRMED',
      addedByGuest: `Waiter: ${req.user.name}`,
    });
  }

  subtotal = round2(subtotal);
  const taxPercent = restaurant?.settings?.taxPercent ?? 5;
  const serviceChargePercent = restaurant?.settings?.serviceChargePercent ?? 0;

  const tax = round2((subtotal * taxPercent) / 100);
  const serviceCharge = round2((subtotal * serviceChargePercent) / 100);
  const total = round2(subtotal + tax + serviceCharge);

  const orderNo = await generateOrderNo(table.branchId);

  const order = await Order.create({
    branchId: table.branchId,
    sessionId: session._id,
    tableId: table._id,
    orderNo,
    status: 'CONFIRMED',
    items: orderItems,
    subtotal,
    tax,
    serviceCharge,
    discount: 0,
    total,
    idempotencyKey,
    events: [
      {
        from: null,
        to: 'CONFIRMED',
        by: `${req.user.name} (${req.user.role})`,
        at: new Date(),
        reason: 'Placed directly by waiter',
      },
    ],
    placedBy: 'WAITER',
  });

  table.status = 'WAITING';
  await table.save();

  const populatedOrder = await Order.findById(order._id).populate('tableId', 'name section');

  emitToBranch(table.branchId, 'order:new', { order: populatedOrder });
  emitToSession(session._id, 'order:updated', { order: populatedOrder });
  emitToBranch(table.branchId, 'table:updated', { table });

  await logActivity({
    branchId: table.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'ORDER_PLACED_BY_WAITER',
    entityType: 'Order',
    entityId: order._id,
    details: { orderNo: order.orderNo, table: table.name, total: order.total },
  });

  res.status(201).json({
    success: true,
    data: { order: populatedOrder },
  });
});

// PATCH /api/v1/orders/:id/confirm
export const confirmOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!order) return next(new ApiError(404, 'Order not found.'));

  assertValidOrderTransition({
    currentStatus: order.status,
    nextStatus: 'CONFIRMED',
    actorRole: req.user.role,
  });

  const prevStatus = order.status;
  order.status = 'CONFIRMED';
  order.items.forEach((item) => {
    if (item.status === 'PLACED') item.status = 'CONFIRMED';
  });
  order.events.push({
    from: prevStatus,
    to: 'CONFIRMED',
    by: `${req.user.name} (${req.user.role})`,
    at: new Date(),
  });

  await order.save();
  await syncTableAfterOrderChange(order);

  const populated = await Order.findById(order._id).populate('tableId', 'name section');
  emitToBranch(order.branchId, 'order:updated', { order: populated });
  emitToSession(order.sessionId, 'order:updated', { order: populated });

  await logActivity({
    branchId: order.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'ORDER_CONFIRMED',
    entityType: 'Order',
    entityId: order._id,
    details: { orderNo: order.orderNo },
  });

  res.status(200).json({ success: true, data: { order: populated } });
});

// PATCH /api/v1/orders/:id/reject
export const rejectOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!order) return next(new ApiError(404, 'Order not found.'));

  assertValidOrderTransition({
    currentStatus: order.status,
    nextStatus: 'REJECTED',
    actorRole: req.user.role,
  });

  const prevStatus = order.status;
  order.status = 'REJECTED';
  order.rejectReason = req.body.reason;
  order.items.forEach((item) => {
    item.status = 'REJECTED';
  });
  order.events.push({
    from: prevStatus,
    to: 'REJECTED',
    by: `${req.user.name} (${req.user.role})`,
    at: new Date(),
    reason: req.body.reason,
  });

  await order.save();

  const populated = await Order.findById(order._id).populate('tableId', 'name section');
  emitToBranch(order.branchId, 'order:updated', { order: populated });
  emitToSession(order.sessionId, 'order:updated', { order: populated });

  await logActivity({
    branchId: order.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'ORDER_REJECTED',
    entityType: 'Order',
    entityId: order._id,
    details: { orderNo: order.orderNo, reason: req.body.reason },
  });

  res.status(200).json({ success: true, data: { order: populated } });
});

// PATCH /api/v1/orders/:id/status (kitchen: PREPARING, READY; waiter: SERVED)
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status: nextStatus } = req.body;
  const order = await Order.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!order) return next(new ApiError(404, 'Order not found.'));

  assertValidOrderTransition({
    currentStatus: order.status,
    nextStatus,
    actorRole: req.user.role,
  });

  const prevStatus = order.status;
  order.status = nextStatus;
  order.items.forEach((item) => {
    if (!['CANCELLED', 'REJECTED'].includes(item.status)) {
      item.status = nextStatus;
    }
  });
  order.events.push({
    from: prevStatus,
    to: nextStatus,
    by: `${req.user.name} (${req.user.role})`,
    at: new Date(),
  });

  await order.save();
  await syncTableAfterOrderChange(order);

  const populated = await Order.findById(order._id).populate('tableId', 'name section');
  emitToBranch(order.branchId, 'order:updated', { order: populated });
  emitToSession(order.sessionId, 'order:updated', { order: populated });

  await logActivity({
    branchId: order.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: `ORDER_${nextStatus}`,
    entityType: 'Order',
    entityId: order._id,
    details: { orderNo: order.orderNo, from: prevStatus, to: nextStatus },
  });

  res.status(200).json({ success: true, data: { order: populated } });
});

// PATCH /api/v1/orders/:id/cancel (only before PREPARING)
export const cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!order) return next(new ApiError(404, 'Order not found.'));

  assertValidOrderTransition({
    currentStatus: order.status,
    nextStatus: 'CANCELLED',
    actorRole: req.user.role,
  });

  const prevStatus = order.status;
  order.status = 'CANCELLED';
  order.cancelReason = req.body.reason;
  order.items.forEach((item) => {
    item.status = 'CANCELLED';
  });
  order.events.push({
    from: prevStatus,
    to: 'CANCELLED',
    by: `${req.user.name} (${req.user.role})`,
    at: new Date(),
    reason: req.body.reason,
  });

  await order.save();

  const populated = await Order.findById(order._id).populate('tableId', 'name section');
  emitToBranch(order.branchId, 'order:updated', { order: populated });
  emitToSession(order.sessionId, 'order:updated', { order: populated });

  await logActivity({
    branchId: order.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'ORDER_CANCELLED',
    entityType: 'Order',
    entityId: order._id,
    details: { orderNo: order.orderNo, reason: req.body.reason },
  });

  res.status(200).json({ success: true, data: { order: populated } });
});

// PATCH /api/v1/orders/:id/items/:itemId/status
export const updateOrderItemStatus = asyncHandler(async (req, res, next) => {
  const { id, itemId } = req.params;
  const { status: nextItemStatus } = req.body;

  const order = await Order.findOne({ _id: id, ...getBranchFilter(req) });
  if (!order) return next(new ApiError(404, 'Order not found.'));

  const item = order.items.id(itemId);
  if (!item) return next(new ApiError(404, 'Order item not found.'));

  if (['PREPARING', 'READY'].includes(nextItemStatus) && !['kitchen', 'admin', 'superadmin'].includes(req.user.role)) {
    return next(new ApiError(403, `Role '${req.user.role}' cannot set item status to ${nextItemStatus}.`));
  }
  if (nextItemStatus === 'SERVED' && !['waiter', 'admin', 'superadmin'].includes(req.user.role)) {
    return next(new ApiError(403, `Role '${req.user.role}' cannot set item status to SERVED.`));
  }

  const prevItemStatus = item.status;
  item.status = nextItemStatus;

  // Auto-roll up overall order status based on active items
  const activeItems = order.items.filter((i) => !['CANCELLED', 'REJECTED'].includes(i.status));
  if (activeItems.length > 0) {
    if (activeItems.every((i) => i.status === 'SERVED')) {
      order.status = 'SERVED';
    } else if (activeItems.every((i) => ['READY', 'SERVED'].includes(i.status))) {
      order.status = 'READY';
    } else if (activeItems.some((i) => i.status === 'PREPARING')) {
      order.status = 'PREPARING';
    }
  }

  order.events.push({
    from: prevItemStatus,
    to: nextItemStatus,
    by: `${req.user.name} (${req.user.role})`,
    at: new Date(),
    reason: `Item '${item.name}' updated`,
  });

  await order.save();
  await syncTableAfterOrderChange(order);

  const populated = await Order.findById(order._id).populate('tableId', 'name section');
  emitToBranch(order.branchId, 'order:updated', { order: populated });
  emitToSession(order.sessionId, 'order:updated', { order: populated });

  res.status(200).json({ success: true, data: { order: populated } });
});

// Staff Waiter Calls: GET /api/v1/calls, PATCH /calls/:id/acknowledge, PATCH /calls/:id/resolve
export const listWaiterCalls = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);
  if (req.query.status) {
    filter.status = req.query.status.toUpperCase();
  } else {
    filter.status = { $in: ['OPEN', 'ACKNOWLEDGED'] };
  }

  const calls = await WaiterCall.find(filter)
    .populate('tableId', 'name section')
    .populate('acknowledgedBy', 'name role')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { count: calls.length, calls },
  });
});

export const acknowledgeWaiterCall = asyncHandler(async (req, res, next) => {
  const call = await WaiterCall.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!call) return next(new ApiError(404, 'Waiter call not found.'));

  if (call.status === 'RESOLVED') {
    return next(new ApiError(400, 'This call has already been resolved.'));
  }

  call.status = 'ACKNOWLEDGED';
  call.acknowledgedBy = req.user._id;
  await call.save();

  const populated = await WaiterCall.findById(call._id)
    .populate('tableId', 'name section')
    .populate('acknowledgedBy', 'name role');

  emitToBranch(call.branchId, 'call:updated', { call: populated });
  if (call.sessionId) {
    emitToSession(call.sessionId, 'call:updated', { call: populated });
  }

  res.status(200).json({ success: true, data: { call: populated } });
});

export const resolveWaiterCall = asyncHandler(async (req, res, next) => {
  const call = await WaiterCall.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!call) return next(new ApiError(404, 'Waiter call not found.'));

  call.status = 'RESOLVED';
  if (!call.acknowledgedBy) call.acknowledgedBy = req.user._id;
  await call.save();

  const populated = await WaiterCall.findById(call._id)
    .populate('tableId', 'name section')
    .populate('acknowledgedBy', 'name role');

  emitToBranch(call.branchId, 'call:updated', { call: populated });
  if (call.sessionId) {
    emitToSession(call.sessionId, 'call:updated', { call: populated });
  }

  res.status(200).json({ success: true, data: { call: populated } });
});

// POST /api/v1/sessions/:id/close
export const closeTableSession = asyncHandler(async (req, res, next) => {
  const session = await TableSession.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!session) return next(new ApiError(404, 'Table session not found.'));

  if (session.status === 'CLOSED') {
    return next(new ApiError(400, 'Session is already closed.'));
  }

  // Ensure no unserved/unpaid active orders block closing unless rejected/cancelled
  const openOrdersCount = await Order.countDocuments({
    sessionId: session._id,
    status: { $in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] },
  });

  if (openOrdersCount > 0) {
    return next(
      new ApiError(
        400,
        `Cannot close session while ${openOrdersCount} order(s) are still active in kitchen/service.`
      )
    );
  }

  session.status = 'CLOSED';
  session.closedAt = new Date();
  session.cart = [];
  await session.save();

  // Reset primary table and any merged tables to EMPTY
  const allTableIds = [session.tableId, ...(session.mergedTableIds || [])];
  await Table.updateMany({ _id: { $in: allTableIds } }, { $set: { status: 'EMPTY' } });

  const updatedTables = await Table.find({ _id: { $in: allTableIds } });
  for (const t of updatedTables) {
    emitToBranch(session.branchId, 'table:updated', { table: t });
  }

  await logActivity({
    branchId: session.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'SESSION_CLOSED',
    entityType: 'TableSession',
    entityId: session._id,
    details: { tables: updatedTables.map((t) => t.name) },
  });

  res.status(200).json({
    success: true,
    data: {
      message: 'Session closed and tables reset to EMPTY.',
      session,
      tables: updatedTables,
    },
  });
});
