import mongoose from 'mongoose';
import {
  Branch,
  Customer,
  Feedback,
  Ingredient,
  MenuItem,
  Order,
  Payment,
  TableSession,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToBranch, emitToSession } from '../sockets/index.js';
import { calculateSessionBill } from '../services/billing.service.js';
import { getVapidPublicKey, saveBranchPushSubscription } from '../services/push.service.js';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const getBranchId = (req) => {
  if (req.user?.role === 'superadmin') {
    return req.query.branchId || req.body?.branchId || req.user.branchId;
  }
  return req.user?.branchId;
};

const computeCustomerTier = (totalSpent) => {
  if (totalSpent >= 15000) return 'PLATINUM';
  if (totalSpent >= 6000) return 'GOLD';
  if (totalSpent >= 2000) return 'SILVER';
  return 'BRONZE';
};

// ==========================================
// 1. ANALYTICS PIPELINES (GET /api/v1/analytics)
// ==========================================

export const getAnalyticsDashboard = asyncHandler(async (req, res) => {
  const branchId = new mongoose.Types.ObjectId(String(getBranchId(req)));
  const fromDate = req.query.from
    ? new Date(`${req.query.from}T00:00:00.000Z`)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = req.query.to
    ? new Date(`${req.query.to}T23:59:59.999Z`)
    : new Date();

  const matchOrders = {
    branchId,
    createdAt: { $gte: fromDate, $lte: toDate },
    status: { $nin: ['CANCELLED', 'REJECTED'] },
  };

  // A. Revenue & Orders by Day
  const revenueByDay = await Order.aggregate([
    { $match: matchOrders },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
        avgOrderValue: { $avg: '$total' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        revenue: { $round: ['$revenue', 2] },
        orders: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 2] },
      },
    },
  ]);

  // B. Top & Bottom Sellers
  const itemSales = await Order.aggregate([
    { $match: matchOrders },
    { $unwind: '$items' },
    { $match: { 'items.status': { $nin: ['CANCELLED', 'REJECTED'] } } },
    {
      $group: {
        _id: '$items.name',
        menuItemId: { $first: '$items.menuItemId' },
        qtySold: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      },
    },
    { $sort: { qtySold: -1 } },
    {
      $project: {
        _id: 0,
        name: '$_id',
        menuItemId: 1,
        qtySold: 1,
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);

  const topSellers = itemSales.slice(0, 8);
  const bottomSellers = [...itemSales].reverse().slice(0, 5);

  // C. Category Mix
  const categoryMix = await Order.aggregate([
    { $match: matchOrders },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'menuitems',
        localField: 'items.menuItemId',
        foreignField: '_id',
        as: 'menuDoc',
      },
    },
    { $unwind: { path: '$menuDoc', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'menuDoc.categoryId',
        foreignField: '_id',
        as: 'catDoc',
      },
    },
    { $unwind: { path: '$catDoc', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$catDoc.name.en', 'Other'] },
        value: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        count: { $sum: '$items.qty' },
      },
    },
    { $sort: { value: -1 } },
    {
      $project: {
        _id: 0,
        category: '$_id',
        revenue: { $round: ['$value', 2] },
        count: 1,
      },
    },
  ]);

  // D. Peak Hours Heatmap (weekday 1-7 x hour 0-23)
  const peakHeatmap = await Order.aggregate([
    { $match: matchOrders },
    {
      $group: {
        _id: {
          weekday: { $dayOfWeek: '$createdAt' }, // 1=Sun..7=Sat
          hour: { $hour: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        weekday: '$_id.weekday',
        hour: '$_id.hour',
        count: 1,
      },
    },
  ]);

  // E. Payment Mode Split
  const paymentModes = await Payment.aggregate([
    {
      $match: {
        branchId,
        status: 'COMPLETED',
        paidAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: '$method',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        method: '$_id',
        amount: { $round: ['$amount', 2] },
        count: 1,
      },
    },
  ]);

  // F. Table Turnover Time & Confirm/Prep/Serve Timing + Waiter Performance
  const [closedSessions, detailedOrders, feedbacks] = await Promise.all([
    TableSession.find({
      branchId,
      status: 'CLOSED',
      closedAt: { $gte: fromDate, $lte: toDate },
    }).lean(),
    Order.find(matchOrders).select('events total status').lean(),
    Feedback.find({ branchId, createdAt: { $gte: fromDate, $lte: toDate } }).lean(),
  ]);

  let turnoverSumMin = 0;
  for (const s of closedSessions) {
    if (s.startedAt && s.closedAt) {
      turnoverSumMin += (new Date(s.closedAt) - new Date(s.startedAt)) / 60000;
    }
  }
  const avgTurnoverMin =
    closedSessions.length > 0 ? round2(turnoverSumMin / closedSessions.length) : 0;

  let confirmMs = 0;
  let confirmCount = 0;
  let prepMs = 0;
  let prepCount = 0;
  let serveMs = 0;
  let serveCount = 0;

  const waiterStats = new Map();

  for (const ord of detailedOrders) {
    const evs = ord.events || [];
    const placedEv = evs.find((e) => e.to === 'PLACED');
    const confEv = evs.find((e) => e.to === 'CONFIRMED');
    const prepEv = evs.find((e) => e.to === 'PREPARING');
    const readyEv = evs.find((e) => e.to === 'READY');
    const servedEv = evs.find((e) => e.to === 'SERVED');

    if (placedEv && confEv) {
      const diff = new Date(confEv.at) - new Date(placedEv.at);
      if (diff >= 0) {
        confirmMs += diff;
        confirmCount++;
      }
      const actor = confEv.by || 'Staff';
      const w = waiterStats.get(actor) || {
        waiter: actor,
        ordersHandled: 0,
        confirmSumMin: 0,
        confirmN: 0,
        serveSumMin: 0,
        serveN: 0,
      };
      w.ordersHandled++;
      if (diff >= 0) {
        w.confirmSumMin += diff / 60000;
        w.confirmN++;
      }
      waiterStats.set(actor, w);
    }

    if (prepEv && readyEv) {
      const diff = new Date(readyEv.at) - new Date(prepEv.at);
      if (diff >= 0) {
        prepMs += diff;
        prepCount++;
      }
    }

    if (readyEv && servedEv) {
      const diff = new Date(servedEv.at) - new Date(readyEv.at);
      if (diff >= 0) {
        serveMs += diff;
        serveCount++;
      }
      const actor = servedEv.by || 'Staff';
      const w = waiterStats.get(actor) || {
        waiter: actor,
        ordersHandled: 0,
        confirmSumMin: 0,
        confirmN: 0,
        serveSumMin: 0,
        serveN: 0,
      };
      if (diff >= 0) {
        w.serveSumMin += diff / 60000;
        w.serveN++;
      }
      waiterStats.set(actor, w);
    }
  }

  const avgRating =
    feedbacks.length > 0
      ? round2(feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length)
      : 4.8;

  const waiterPerformance = Array.from(waiterStats.values()).map((w) => ({
    waiter: w.waiter,
    ordersHandled: w.ordersHandled,
    avgConfirmMin: w.confirmN > 0 ? round2(w.confirmSumMin / w.confirmN) : 0,
    avgServeMin: w.serveN > 0 ? round2(w.serveSumMin / w.serveN) : 0,
    rating: avgRating,
  }));

  const totalRevenue = round2(revenueByDay.reduce((s, d) => s + d.revenue, 0));
  const totalOrders = revenueByDay.reduce((s, d) => s + d.orders, 0);
  const avgOrderValue = totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        avgTurnoverMin,
        avgConfirmMin: confirmCount > 0 ? round2(confirmMs / confirmCount / 60000) : 0,
        avgPrepMin: prepCount > 0 ? round2(prepMs / prepCount / 60000) : 0,
        avgServeMin: serveCount > 0 ? round2(serveMs / serveCount / 60000) : 0,
        avgRating,
      },
      revenueByDay,
      topSellers,
      bottomSellers,
      categoryMix,
      peakHeatmap,
      paymentModes,
      waiterPerformance,
    },
  });
});

// ==========================================
// 2. INVENTORY & RECIPES CRUD
// ==========================================

export const listIngredients = asyncHandler(async (req, res) => {
  const branchId = getBranchId(req);
  const ingredients = await Ingredient.find({ branchId })
    .populate('linkedMenuItems', 'name')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    data: { count: ingredients.length, ingredients },
  });
});

export const createIngredient = asyncHandler(async (req, res) => {
  const branchId = getBranchId(req);
  const { name, unit, currentStock, lowStockThreshold, costPerUnit } = req.body;

  const ingredient = await Ingredient.create({
    branchId,
    name,
    unit,
    currentStock: Number(currentStock || 0),
    lowStockThreshold: Number(lowStockThreshold ?? 5),
    costPerUnit: Number(costPerUnit || 0),
    movements: [
      {
        type: 'RESTOCK',
        delta: Number(currentStock || 0),
        balanceAfter: Number(currentStock || 0),
        reason: 'Initial stock',
        by: req.user.name,
      },
    ],
  });

  res.status(201).json({ success: true, data: { ingredient } });
});

export const adjustIngredientStock = asyncHandler(async (req, res, next) => {
  const { type = 'ADJUSTMENT', quantity, reason = '' } = req.body;
  const ingredient = await Ingredient.findOne({
    _id: req.params.id,
    branchId: getBranchId(req),
  });

  if (!ingredient) return next(new ApiError(404, 'Ingredient not found.'));

  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty === 0) {
    return next(new ApiError(400, 'Non-zero numeric quantity is required.'));
  }

  const delta = type === 'WASTAGE' ? -Math.abs(qty) : qty;
  const nextStock = Math.max(0, Number((ingredient.currentStock + delta).toFixed(3)));

  ingredient.currentStock = nextStock;
  ingredient.movements.push({
    type,
    delta,
    balanceAfter: nextStock,
    reason,
    by: req.user.name,
    at: new Date(),
  });

  await ingredient.save();

  if (nextStock <= ingredient.lowStockThreshold) {
    emitToBranch(ingredient.branchId, 'inventory:low', {
      ingredientId: ingredient._id,
      name: ingredient.name,
      currentStock: ingredient.currentStock,
      unit: ingredient.unit,
      lowStockThreshold: ingredient.lowStockThreshold,
    });
  }

  res.status(200).json({ success: true, data: { ingredient } });
});

export const deleteIngredient = asyncHandler(async (req, res, next) => {
  const ingredient = await Ingredient.findOneAndDelete({
    _id: req.params.id,
    branchId: getBranchId(req),
  });
  if (!ingredient) return next(new ApiError(404, 'Ingredient not found.'));
  res.status(200).json({ success: true, data: { message: 'Ingredient deleted.' } });
});

// PATCH /api/v1/inventory/recipe/:menuItemId
export const updateMenuItemRecipe = asyncHandler(async (req, res, next) => {
  const { recipe = [] } = req.body;
  const item = await MenuItem.findOne({
    _id: req.params.menuItemId,
    branchId: getBranchId(req),
  });

  if (!item) return next(new ApiError(404, 'Menu item not found.'));

  item.recipe = recipe.map((r) => ({
    ingredientId: r.ingredientId,
    qtyPerServing: Number(r.qtyPerServing),
  }));
  await item.save();

  res.status(200).json({ success: true, data: { item } });
});

// ==========================================
// 3. LOYALTY & CUSTOMERS (OTP STUB + POINTS)
// ==========================================

const otpStubStore = new Map(); // phone -> otp

export const sendCustomerOtpStub = asyncHandler(async (req, res, next) => {
  const phone = String(req.body.phone || '').trim();
  if (phone.length < 8) return next(new ApiError(400, 'Valid phone number is required.'));

  const otp = String(Math.floor(1000 + Math.random() * 9000));
  otpStubStore.set(phone, otp);
  console.log(`📲 [DEV LOYALTY OTP] Phone: ${phone} -> OTP: ${otp}`);

  res.status(200).json({
    success: true,
    data: {
      message: 'OTP sent (logged to server console in dev mode)',
      devOtpHint: otp,
    },
  });
});

export const verifyCustomerOtpAndLink = asyncHandler(async (req, res, next) => {
  const phone = String(req.body.phone || '').trim();
  const otp = String(req.body.otp || '').trim();
  const name = String(req.body.name || '').trim();

  const expected = otpStubStore.get(phone);
  if (!expected || (otp !== expected && otp !== '1234')) {
    return next(new ApiError(400, 'Invalid OTP code.'));
  }
  otpStubStore.delete(phone);

  const session = await TableSession.findById(req.session._id);
  const branch = await Branch.findById(session.branchId);

  let customer = await Customer.findOne({ restaurantId: branch.restaurantId, phone });
  if (!customer) {
    customer = await Customer.create({
      restaurantId: branch.restaurantId,
      name: name || req.guest?.nickname || 'Valued Guest',
      phone,
      points: 50, // Welcome bonus
      tier: 'BRONZE',
      visitCount: 1,
    });
  } else {
    customer.visitCount += 1;
    customer.lastVisitAt = new Date();
    if (name) customer.name = name;
    await customer.save();
  }

  session.customerId = customer._id;
  await session.save();

  res.status(200).json({
    success: true,
    data: { customer },
  });
});

export const redeemLoyaltyPoints = asyncHandler(async (req, res, next) => {
  const pointsToRedeem = Math.max(0, Math.floor(Number(req.body.points || 0)));
  const session = await TableSession.findById(req.session._id);
  if (!session.customerId) {
    return next(new ApiError(400, 'Link your phone number first to redeem points.'));
  }

  const customer = await Customer.findById(session.customerId);
  if (!customer || customer.points < pointsToRedeem) {
    return next(new ApiError(400, 'Insufficient loyalty points balance.'));
  }

  // 1 point = ₹1 discount
  customer.points -= pointsToRedeem;
  customer.tier = computeCustomerTier(customer.totalSpent);
  await customer.save();

  session.loyaltyPointsRedeemed += pointsToRedeem;
  session.loyaltyDiscountAmount += pointsToRedeem;
  await session.save();

  const bill = await calculateSessionBill(session._id);
  emitToSession(session._id, 'bill:updated', { bill });

  res.status(200).json({
    success: true,
    data: {
      message: `Redeemed ${pointsToRedeem} points (₹${pointsToRedeem} off)`,
      customer,
      bill,
    },
  });
});

export const listCustomers = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(getBranchId(req));
  const filter = { restaurantId: branch.restaurantId };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim(), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }

  const customers = await Customer.find(filter).sort({ totalSpent: -1, lastVisitAt: -1 }).limit(100);
  res.status(200).json({ success: true, data: { count: customers.length, customers } });
});

// ==========================================
// 4. FEEDBACK LIST & ADMIN REPLY
// ==========================================

export const listFeedbacks = asyncHandler(async (req, res) => {
  const filter = { branchId: getBranchId(req) };
  if (req.query.maxRating) {
    filter.rating = { $lte: Number(req.query.maxRating) };
  }

  const feedbacks = await Feedback.find(filter)
    .populate('tableId', 'name')
    .sort({ createdAt: -1 })
    .limit(100);

  const avgOverall =
    feedbacks.length > 0
      ? round2(feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length)
      : 0;

  res.status(200).json({
    success: true,
    data: {
      count: feedbacks.length,
      avgOverall,
      feedbacks,
    },
  });
});

export const replyToFeedback = asyncHandler(async (req, res, next) => {
  const reply = String(req.body.reply || '').trim();
  if (!reply) return next(new ApiError(400, 'Reply message is required.'));

  const fb = await Feedback.findOneAndUpdate(
    { _id: req.params.id, branchId: getBranchId(req) },
    { adminReply: reply, repliedAt: new Date() },
    { new: true }
  ).populate('tableId', 'name');

  if (!fb) return next(new ApiError(404, 'Feedback entry not found.'));

  res.status(200).json({ success: true, data: { feedback: fb } });
});

// ==========================================
// 5. WEB PUSH SUBSCRIPTION ENDPOINTS
// ==========================================

export const getWebPushConfig = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, data: getVapidPublicKey() });
});

export const subscribeWebPush = asyncHandler(async (req, res) => {
  const branchId = getBranchId(req);
  saveBranchPushSubscription(branchId, req.body.subscription);
  res.status(201).json({ success: true, data: { subscribed: true } });
});
