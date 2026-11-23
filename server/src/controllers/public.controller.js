import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import {
  Branch,
  Category,
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
import { emitToBranch, emitToSession } from '../sockets/index.js';
import { sendPushToBranch } from '../services/push.service.js';

const signSessionToken = ({ sessionId, guestId, nickname, branchId, tableId }) => {
  return jwt.sign(
    {
      type: 'CUSTOMER_SESSION',
      sessionId: String(sessionId),
      guestId,
      nickname,
      branchId: String(branchId),
      tableId: String(tableId),
    },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const getPublicMenuByQr = asyncHandler(async (req, res, next) => {
  const { branchSlug, qrToken } = req.params;

  const branch = await Branch.findOne({ slug: branchSlug.toLowerCase(), isActive: true });
  if (!branch) {
    return next(new ApiError(404, 'Restaurant branch not found or inactive.'));
  }

  const table = await Table.findOne({
    branchId: branch._id,
    qrToken,
    isActive: true,
  });
  if (!table) {
    return next(new ApiError(401, 'Invalid or expired table QR code. Please scan again or ask staff.'));
  }

  const [restaurant, categories, items] = await Promise.all([
    Restaurant.findById(branch.restaurantId).select('name logo currency settings'),
    Category.find({ branchId: branch._id, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }),
    MenuItem.find({ branchId: branch._id, isAvailable: true })
      .populate('categoryId', 'name station sortOrder')
      .sort({ isBestseller: -1, createdAt: 1 }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      restaurant: restaurant
        ? {
            id: restaurant._id,
            name: restaurant.name,
            logo: restaurant.logo,
            currency: restaurant.currency,
            taxPercent: restaurant.settings?.taxPercent ?? 5,
            serviceChargePercent: restaurant.settings?.serviceChargePercent ?? 0,
            geofence: restaurant.settings?.geofence || { enabled: false },
            languages: restaurant.settings?.languages ?? ['en', 'hi', 'gu'],
          }
        : null,
      branch: {
        id: branch._id,
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        openingHours: branch.openingHours,
      },
      table: {
        id: table._id,
        name: table.name,
        seats: table.seats,
        section: table.section,
        status: table.status,
      },
      categories,
      items,
      credit: 'Designed & Developed by HeryxStudio',
    },
  });
});

// POST /api/v1/public/session/start
export const startTableSession = asyncHandler(async (req, res, next) => {
  const { branchSlug, qrToken, nickname } = req.body;

  const branch = await Branch.findOne({ slug: branchSlug, isActive: true });
  if (!branch) {
    return next(new ApiError(404, 'Branch not found or inactive.'));
  }

  const table = await Table.findOne({ branchId: branch._id, qrToken, isActive: true });
  if (!table) {
    return next(new ApiError(401, 'Invalid or expired table QR code.'));
  }

  let session = await TableSession.findOne({
    branchId: branch._id,
    status: 'OPEN',
    $or: [{ tableId: table._id }, { mergedTableIds: table._id }],
  });

  if (!session) {
    const guestId = `gst_${nanoid(10)}`;
    const guestNickname = nickname || 'Guest 1';
    session = await TableSession.create({
      branchId: branch._id,
      tableId: table._id,
      status: 'OPEN',
      guests: [{ id: guestId, nickname: guestNickname }],
      cart: [],
    });

    if (table.status === 'EMPTY') {
      table.status = 'SEATED';
      await table.save();
      emitToBranch(branch._id, 'table:updated', { table });
    }

    const sessionToken = signSessionToken({
      sessionId: session._id,
      guestId,
      nickname: guestNickname,
      branchId: branch._id,
      tableId: table._id,
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionToken,
        guest: { id: guestId, nickname: guestNickname },
        session,
        table,
      },
    });
  }

  const nextGuestNumber = session.guests.length + 1;
  const guestId = `gst_${nanoid(10)}`;
  const guestNickname = nickname || `Guest ${nextGuestNumber}`;

  session.guests.push({ id: guestId, nickname: guestNickname });
  await session.save();

  if (table.status === 'EMPTY') {
    table.status = 'SEATED';
    await table.save();
    emitToBranch(branch._id, 'table:updated', { table });
  }

  const sessionToken = signSessionToken({
    sessionId: session._id,
    guestId,
    nickname: guestNickname,
    branchId: branch._id,
    tableId: session.tableId,
  });

  res.status(200).json({
    success: true,
    data: {
      sessionToken,
      guest: { id: guestId, nickname: guestNickname },
      session,
      table,
    },
  });
});

// PATCH /api/v1/public/session/guest (Rename current guest in group ordering)
export const renameSessionGuest = asyncHandler(async (req, res, next) => {
  const newNickname = String(req.body.nickname || '').trim();
  if (newNickname.length < 1 || newNickname.length > 30) {
    return next(new ApiError(400, 'Nickname must be between 1 and 30 characters.'));
  }

  const session = await TableSession.findById(req.session._id);
  const guestObj = session.guests.find((g) => g.id === req.guest.id);
  const oldNickname = guestObj?.nickname || req.guest.nickname;

  if (guestObj) {
    guestObj.nickname = newNickname;
  } else {
    session.guests.push({ id: req.guest.id, nickname: newNickname });
  }

  // Update cart items added by this guest
  session.cart.forEach((c) => {
    if (c.addedByGuestId === req.guest.id || c.addedByGuest === oldNickname) {
      c.addedByGuest = newNickname;
      c.addedByGuestId = req.guest.id;
    }
  });

  await session.save();

  const updatedToken = signSessionToken({
    sessionId: session._id,
    guestId: req.guest.id,
    nickname: newNickname,
    branchId: session.branchId,
    tableId: session.tableId,
  });

  const subtotal = round2(session.cart.reduce((sum, item) => sum + item.price * item.qty, 0));
  emitToSession(session._id, 'cart:updated', {
    sessionId: session._id,
    cart: session.cart,
    subtotal,
  });

  res.status(200).json({
    success: true,
    data: {
      sessionToken: updatedToken,
      guest: { id: req.guest.id, nickname: newNickname },
      cart: session.cart,
      subtotal,
    },
  });
});

export const getSessionCart = asyncHandler(async (req, res) => {
  const session = await TableSession.findById(req.session._id);
  const subtotal = round2(session.cart.reduce((sum, item) => sum + item.price * item.qty, 0));

  res.status(200).json({
    success: true,
    data: {
      sessionId: session._id,
      guests: session.guests,
      cart: session.cart,
      subtotal,
    },
  });
});

export const addToSessionCart = asyncHandler(async (req, res, next) => {
  const { menuItemId, qty, variantName, addonNames, note } = req.body;

  const menuItem = await MenuItem.findOne({
    _id: menuItemId,
    branchId: req.session.branchId,
  });

  if (!menuItem) {
    return next(new ApiError(404, 'Menu item not found.'));
  }
  if (!menuItem.isAvailable) {
    return next(new ApiError(400, `${menuItem.name.en} is currently out of stock.`));
  }

  let unitBasePrice = menuItem.price;
  let selectedVariant = undefined;

  if (variantName) {
    const foundVariant = (menuItem.variants || []).find(
      (v) => v.name.toLowerCase() === variantName.toLowerCase()
    );
    if (!foundVariant) {
      return next(new ApiError(400, `Invalid variant '${variantName}' for ${menuItem.name.en}.`));
    }
    unitBasePrice = foundVariant.price;
    selectedVariant = { name: foundVariant.name, price: foundVariant.price };
  }

  const selectedAddons = [];
  let addonsTotal = 0;

  if (addonNames && addonNames.length > 0) {
    for (const aName of addonNames) {
      const foundAddon = (menuItem.addons || []).find(
        (a) => a.name.toLowerCase() === aName.toLowerCase()
      );
      if (!foundAddon) {
        return next(new ApiError(400, `Invalid addon '${aName}' for ${menuItem.name.en}.`));
      }
      selectedAddons.push({ name: foundAddon.name, price: foundAddon.price });
      addonsTotal += foundAddon.price;
    }
  }

  const finalUnitPrice = round2(unitBasePrice + addonsTotal);
  const session = await TableSession.findById(req.session._id);

  const existingIdx = session.cart.findIndex((c) => {
    const sameItem = String(c.menuItemId) === String(menuItem._id);
    const sameGuest = (c.addedByGuest || '') === (req.guest.nickname || '');
    const sameVariant = (c.variant?.name || '') === (selectedVariant?.name || '');
    const sameNote = (c.note || '') === (note || '');
    const existingAddonStr = (c.addons || []).map((a) => a.name).sort().join('|');
    const newAddonStr = selectedAddons.map((a) => a.name).sort().join('|');
    return sameItem && sameGuest && sameVariant && sameNote && existingAddonStr === newAddonStr;
  });

  if (existingIdx > -1) {
    session.cart[existingIdx].qty += qty;
    session.cart[existingIdx].price = finalUnitPrice;
  } else {
    session.cart.push({
      menuItemId: menuItem._id,
      name: menuItem.name.en,
      price: finalUnitPrice,
      qty,
      ...(selectedVariant ? { variant: selectedVariant } : {}),
      addons: selectedAddons,
      note: note || '',
      addedByGuest: req.guest.nickname,
      addedByGuestId: req.guest.id,
    });
  }

  await session.save();

  const table = await Table.findById(session.tableId);
  if (table && table.status !== 'ORDERING') {
    table.status = 'ORDERING';
    await table.save();
    emitToBranch(session.branchId, 'table:updated', { table });
  }

  const subtotal = round2(session.cart.reduce((sum, item) => sum + item.price * item.qty, 0));

  emitToSession(session._id, 'cart:updated', {
    sessionId: session._id,
    cart: session.cart,
    subtotal,
  });

  res.status(200).json({
    success: true,
    data: {
      cart: session.cart,
      subtotal,
    },
  });
});

export const updateSessionCartItem = asyncHandler(async (req, res, next) => {
  const { cartItemId } = req.params;
  const { qty, note } = req.body;

  const session = await TableSession.findById(req.session._id);
  const cartItem = session.cart.id(cartItemId);

  if (!cartItem) {
    return next(new ApiError(404, 'Cart item not found.'));
  }

  if (qty === 0) {
    cartItem.deleteOne();
  } else {
    if (qty !== undefined) cartItem.qty = qty;
    if (note !== undefined) cartItem.note = note;
  }

  await session.save();

  const table = await Table.findById(session.tableId);
  if (table) {
    const nextTableStatus = session.cart.length > 0 ? 'ORDERING' : 'SEATED';
    if (table.status !== nextTableStatus) {
      table.status = nextTableStatus;
      await table.save();
      emitToBranch(session.branchId, 'table:updated', { table });
    }
  }

  const subtotal = round2(session.cart.reduce((sum, item) => sum + item.price * item.qty, 0));

  emitToSession(session._id, 'cart:updated', {
    sessionId: session._id,
    cart: session.cart,
    subtotal,
  });

  res.status(200).json({
    success: true,
    data: {
      cart: session.cart,
      subtotal,
    },
  });
});

export const removeSessionCartItem = asyncHandler(async (req, res, next) => {
  const { cartItemId } = req.params;

  const session = await TableSession.findById(req.session._id);
  const cartItem = session.cart.id(cartItemId);

  if (!cartItem) {
    return next(new ApiError(404, 'Cart item not found.'));
  }

  cartItem.deleteOne();
  await session.save();

  const table = await Table.findById(session.tableId);
  if (table) {
    const nextTableStatus = session.cart.length > 0 ? 'ORDERING' : 'SEATED';
    if (table.status !== nextTableStatus) {
      table.status = nextTableStatus;
      await table.save();
      emitToBranch(session.branchId, 'table:updated', { table });
    }
  }

  const subtotal = round2(session.cart.reduce((sum, item) => sum + item.price * item.qty, 0));

  emitToSession(session._id, 'cart:updated', {
    sessionId: session._id,
    cart: session.cart,
    subtotal,
  });

  res.status(200).json({
    success: true,
    data: {
      cart: session.cart,
      subtotal,
    },
  });
});

export const placeCustomerOrder = asyncHandler(async (req, res, next) => {
  const { idempotencyKey } = req.body;
  const sessionId = req.session._id;

  const existingOrder = await Order.findOne({ sessionId, idempotencyKey });
  if (existingOrder) {
    return res.status(200).json({
      success: true,
      data: {
        order: existingOrder,
        idempotentReplay: true,
      },
    });
  }

  const session = await TableSession.findById(sessionId);
  if (!session || session.status !== 'OPEN') {
    return next(new ApiError(403, 'Session is no longer open.'));
  }

  if (!session.cart.length) {
    return next(new ApiError(400, 'Your cart is empty. Add items before placing an order.'));
  }

  const branch = await Branch.findById(session.branchId);
  const restaurant = await Restaurant.findById(branch.restaurantId);

  const menuItemIds = session.cart.map((c) => c.menuItemId);
  const dbItems = await MenuItem.find({
    _id: { $in: menuItemIds },
    branchId: session.branchId,
  }).populate('categoryId', 'station');

  const dbItemMap = new Map(dbItems.map((i) => [String(i._id), i]));

  const orderItems = [];
  let subtotal = 0;

  for (const cartEntry of session.cart) {
    const dbItem = dbItemMap.get(String(cartEntry.menuItemId));
    if (!dbItem) {
      return next(new ApiError(400, `Item '${cartEntry.name}' is no longer on the menu.`));
    }
    if (!dbItem.isAvailable) {
      return next(new ApiError(400, `'${dbItem.name.en}' just went out of stock.`));
    }

    let unitPrice = dbItem.price;
    let variantSnapshot = undefined;

    if (cartEntry.variant?.name) {
      const dbVariant = (dbItem.variants || []).find(
        (v) => v.name.toLowerCase() === cartEntry.variant.name.toLowerCase()
      );
      if (!dbVariant) {
        return next(new ApiError(400, `Variant '${cartEntry.variant.name}' is no longer available.`));
      }
      unitPrice = dbVariant.price;
      variantSnapshot = { name: dbVariant.name, price: dbVariant.price };
    }

    const addonsSnapshot = [];
    if (cartEntry.addons && cartEntry.addons.length > 0) {
      for (const a of cartEntry.addons) {
        const dbAddon = (dbItem.addons || []).find(
          (da) => da.name.toLowerCase() === a.name.toLowerCase()
        );
        if (!dbAddon) {
          return next(new ApiError(400, `Addon '${a.name}' is no longer available.`));
        }
        unitPrice += dbAddon.price;
        addonsSnapshot.push({ name: dbAddon.name, price: dbAddon.price });
      }
    }

    unitPrice = round2(unitPrice);
    subtotal += unitPrice * cartEntry.qty;

    orderItems.push({
      menuItemId: dbItem._id,
      name: dbItem.name.en,
      price: unitPrice,
      qty: cartEntry.qty,
      ...(variantSnapshot ? { variant: variantSnapshot } : {}),
      addons: addonsSnapshot,
      note: cartEntry.note || '',
      station: dbItem.categoryId?.station || 'KITCHEN',
      status: 'PLACED',
      addedByGuest: cartEntry.addedByGuest || req.guest.nickname,
    });
  }

  subtotal = round2(subtotal);
  const taxPercent = restaurant?.settings?.taxPercent ?? 5;
  const serviceChargePercent = restaurant?.settings?.serviceChargePercent ?? 0;

  const tax = round2((subtotal * taxPercent) / 100);
  const serviceCharge = round2((subtotal * serviceChargePercent) / 100);
  const discount = 0;
  const total = round2(subtotal + tax + serviceCharge - discount);

  const orderNo = await generateOrderNo(session.branchId);

  let order;
  try {
    order = await Order.create({
      branchId: session.branchId,
      sessionId: session._id,
      tableId: session.tableId,
      orderNo,
      status: 'PLACED',
      items: orderItems,
      subtotal,
      tax,
      serviceCharge,
      discount,
      total,
      idempotencyKey,
      events: [
        {
          from: null,
          to: 'PLACED',
          by: req.guest.nickname,
          at: new Date(),
          reason: 'Placed by customer via QR menu',
        },
      ],
      placedBy: 'CUSTOMER',
    });
  } catch (err) {
    if (err.code === 11000) {
      const racedOrder = await Order.findOne({ sessionId, idempotencyKey });
      if (racedOrder) {
        return res.status(200).json({
          success: true,
          data: { order: racedOrder, idempotentReplay: true },
        });
      }
    }
    throw err;
  }

  session.cart = [];
  await session.save();

  const table = await Table.findByIdAndUpdate(
    session.tableId,
    { status: 'WAITING' },
    { new: true }
  );

  const populatedOrder = await Order.findById(order._id).populate('tableId', 'name section');

  emitToSession(session._id, 'cart:updated', {
    sessionId: session._id,
    cart: [],
    subtotal: 0,
  });
  emitToBranch(session.branchId, 'order:new', { order: populatedOrder });
  emitToSession(session._id, 'order:updated', { order: populatedOrder });
  if (table) {
    emitToBranch(session.branchId, 'table:updated', { table });
  }

  sendPushToBranch(session.branchId, {
    title: `New Order ${order.orderNo}`,
    body: `Table ${table?.name || ''} placed an order (₹${order.total})`,
    url: '/dashboard/waiter',
  });

  res.status(201).json({
    success: true,
    data: {
      order: populatedOrder,
      idempotentReplay: false,
    },
  });
});

export const listCustomerOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ sessionId: req.session._id })
    .populate('tableId', 'name section')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      count: orders.length,
      orders,
    },
  });
});

export const getCustomerOrderTracker = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    sessionId: req.session._id,
  }).populate('tableId', 'name section');

  if (!order) {
    return next(new ApiError(404, 'Order not found for this session.'));
  }

  res.status(200).json({
    success: true,
    data: {
      order,
    },
  });
});

export const createCustomerWaiterCall = asyncHandler(async (req, res, next) => {
  const { type } = req.body;
  const { branchId, tableId, _id: sessionId } = req.session;

  const cooldownCutoff = new Date(Date.now() - 60 * 1000);
  const recentCall = await WaiterCall.findOne({
    branchId,
    tableId,
    type,
    createdAt: { $gte: cooldownCutoff },
  }).sort({ createdAt: -1 });

  if (recentCall) {
    const retryAfterSec = Math.ceil(
      60 - (Date.now() - new Date(recentCall.createdAt).getTime()) / 1000
    );
    return next(
      new ApiError(
        429,
        `Please wait ${Math.max(1, retryAfterSec)} seconds before sending another '${type}' request.`
      )
    );
  }

  const call = await WaiterCall.create({
    branchId,
    tableId,
    sessionId,
    type,
    status: 'OPEN',
  });

  const populatedCall = await WaiterCall.findById(call._id).populate('tableId', 'name section');

  if (type === 'BILL' || type === 'HELP') {
    const tableStatus = type === 'BILL' ? 'NEEDS_BILL' : 'NEEDS_HELP';
    const table = await Table.findByIdAndUpdate(tableId, { status: tableStatus }, { new: true });
    if (table) {
      emitToBranch(branchId, 'table:updated', { table });
    }
  }

  emitToBranch(branchId, 'call:new', { call: populatedCall });

  sendPushToBranch(branchId, {
    title: `Table ${populatedCall.tableId?.name || ''} Call`,
    body: `Requested: ${type}`,
    url: '/dashboard/waiter',
  });

  res.status(201).json({
    success: true,
    data: {
      call: populatedCall,
    },
  });
});
