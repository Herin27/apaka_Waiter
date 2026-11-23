import mongoose from 'mongoose';
import {
  Branch,
  DailySummary,
  MenuItem,
  Order,
  Restaurant,
} from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  parseVoiceOrderWithGemini,
  rerankRecommendationsWithGemini,
  generateDemandForecastAdvice,
} from '../services/gemini.service.js';
import { buildAndSaveDailySummaryForBranch } from '../services/dailySummary.scheduler.js';

const WEEKDAY_NAMES = {
  1: 'Sunday',
  2: 'Monday',
  3: 'Tuesday',
  4: 'Wednesday',
  5: 'Thursday',
  6: 'Friday',
  7: 'Saturday',
};

// POST /api/v1/public/ai/parse-order
export const parseCustomerVoiceOrder = asyncHandler(async (req, res) => {
  const { transcript, language = 'en-IN' } = req.body;
  const branchId = req.session.branchId;

  const branch = await Branch.findById(branchId);
  const restaurant = await Restaurant.findById(branch.restaurantId);

  if (restaurant?.settings?.aiFeatures?.voiceOrdering === false) {
    return res.status(200).json({
      success: true,
      data: { disabled: true, parsedItems: [] },
    });
  }

  const availableItems = await MenuItem.find({ branchId, isAvailable: true })
    .select('name price isVeg image')
    .lean();

  const itemMap = new Map(availableItems.map((i) => [String(i._id), i]));

  const rawMatches = await parseVoiceOrderWithGemini({
    transcript,
    language,
    menuCatalog: availableItems,
  });

  const enriched = rawMatches.map((m) => {
    const doc = itemMap.get(String(m.itemId));
    return {
      itemId: String(m.itemId),
      name: doc?.name || { en: 'Menu Item' },
      price: doc?.price || 0,
      isVeg: doc?.isVeg ?? true,
      image: doc?.image || '',
      quantity: m.quantity,
      confidence: m.confidence,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      transcript,
      parsedItems: enriched,
    },
  });
});

// GET /api/v1/public/ai/recommendations?itemId=&cartItemIds=
export const getCustomerRecommendations = asyncHandler(async (req, res) => {
  const branchId = req.session.branchId;
  const branch = await Branch.findById(branchId);
  const restaurant = await Restaurant.findById(branch.restaurantId);

  if (restaurant?.settings?.aiFeatures?.recommendations === false) {
    return res.status(200).json({
      success: true,
      data: { alsoOrdered: [], goesWellWith: [], cartUpsells: [] },
    });
  }

  const allAvailable = await MenuItem.find({ branchId, isAvailable: true })
    .populate('categoryId', 'name station')
    .lean();

  const targetItemId = req.query.itemId ? String(req.query.itemId) : null;
  const cartIds = req.query.cartItemIds
    ? String(req.query.cartItemIds)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Co-occurrence counts from past orders
  const recentOrders = await Order.find({
    branchId,
    status: { $nin: ['CANCELLED', 'REJECTED'] },
  })
    .select('items.menuItemId')
    .limit(200)
    .lean();

  const coMap = new Map();
  const focusIds = new Set(targetItemId ? [targetItemId, ...cartIds] : cartIds);

  for (const ord of recentOrders) {
    const idsInOrder = Array.from(new Set((ord.items || []).map((i) => String(i.menuItemId))));
    const overlaps = Array.from(focusIds).some((fid) => idsInOrder.includes(fid));
    if (overlaps || focusIds.size === 0) {
      for (const id of idsInOrder) {
        if (!focusIds.has(id)) {
          coMap.set(id, (coMap.get(id) || 0) + 1);
        }
      }
    }
  }

  let candidates = allAvailable.filter((m) => !focusIds.has(String(m._id)));
  candidates.sort((a, b) => {
    const ca = coMap.get(String(a._id)) || 0;
    const cb = coMap.get(String(b._id)) || 0;
    if (cb !== ca) return cb - ca;
    return (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0);
  });

  const topCandidates = candidates.slice(0, 6);
  const contextNames = allAvailable
    .filter((m) => focusIds.has(String(m._id)))
    .map((m) => m.name?.en || '');

  const rankedIds = await rerankRecommendationsWithGemini({
    contextItemNames: contextNames,
    candidateItems: topCandidates,
  });

  const candidateById = new Map(topCandidates.map((c) => [String(c._id), c]));
  const alsoOrdered = rankedIds
    .map((id) => candidateById.get(id))
    .filter(Boolean)
    .slice(0, 4);

  // "Goes well with" (drinks / sides / desserts)
  const goesWellWith = candidates
    .filter((m) => {
      const cat = (m.categoryId?.name?.en || '').toLowerCase();
      return cat.includes('coffee') || cat.includes('cooler') || cat.includes('dessert') || cat.includes('fries');
    })
    .slice(0, 3);

  // Auto-upsells at cart stage (drink with burger/pizza, dessert after main)
  const cartItemsDocs = allAvailable.filter((m) => cartIds.includes(String(m._id)));
  const hasBurgerOrPizza = cartItemsDocs.some((m) => {
    const c = (m.categoryId?.name?.en || '').toLowerCase();
    return c.includes('burger') || c.includes('pizza') || c.includes('sandwich');
  });
  const hasMain = cartItemsDocs.some((m) => {
    const c = (m.categoryId?.name?.en || '').toLowerCase();
    return c.includes('main') || c.includes('biryani');
  });

  let cartUpsells = [];
  if (hasBurgerOrPizza) {
    cartUpsells = allAvailable
      .filter((m) => (m.categoryId?.name?.en || '').toLowerCase().includes('coffee') || (m.categoryId?.name?.en || '').toLowerCase().includes('cooler'))
      .slice(0, 2);
  } else if (hasMain) {
    cartUpsells = allAvailable
      .filter((m) => (m.categoryId?.name?.en || '').toLowerCase().includes('dessert'))
      .slice(0, 2);
  } else {
    cartUpsells = alsoOrdered.slice(0, 2);
  }

  res.status(200).json({
    success: true,
    data: {
      alsoOrdered,
      goesWellWith,
      cartUpsells,
    },
  });
});

// GET /api/v1/public/ai/wait-time -> Pure calculation from kitchen queue & historical prep time
export const getLiveWaitTimePrediction = asyncHandler(async (req, res) => {
  const branchId = req.session.branchId;

  const [queueOrders, recentServedOrders] = await Promise.all([
    Order.find({
      branchId,
      status: { $in: ['PLACED', 'CONFIRMED', 'PREPARING'] },
    }).lean(),
    Order.find({
      branchId,
      status: { $in: ['READY', 'SERVED', 'PAID'] },
    })
      .select('events items')
      .limit(100)
      .lean(),
  ]);

  let avgRealPrepMin = 14;
  const durations = [];

  for (const ord of recentServedOrders) {
    const prepEv = (ord.events || []).find((e) => e.to === 'PREPARING');
    const readyEv = (ord.events || []).find((e) => e.to === 'READY');
    if (prepEv && readyEv) {
      const mins = (new Date(readyEv.at) - new Date(prepEv.at)) / 60000;
      if (mins > 1 && mins < 90) durations.push(mins);
    }
  }

  if (durations.length > 0) {
    avgRealPrepMin = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  const queueCount = queueOrders.length;
  const estimatedMinutes = Math.max(8, avgRealPrepMin + queueCount * 3);

  res.status(200).json({
    success: true,
    data: {
      queueCount,
      avgRealPrepMin,
      estimatedMinutes,
    },
  });
});

// GET /api/v1/analytics/demand-forecast (Admin)
export const getDemandForecast = asyncHandler(async (req, res) => {
  const branchIdStr = req.query.branchId || req.user.branchId;
  const branchId = new mongoose.Types.ObjectId(String(branchIdStr));
  const branch = await Branch.findById(branchId);
  const restaurant = await Restaurant.findById(branch.restaurantId);

  if (restaurant?.settings?.aiFeatures?.demandForecast === false) {
    return res.status(200).json({
      success: true,
      data: {
        disabled: true,
        advice: 'Demand forecasting AI is currently disabled in Restaurant Settings.',
        weekdayStats: [],
      },
    });
  }

  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);

  const agg = await Order.aggregate([
    {
      $match: {
        branchId,
        createdAt: { $gte: eightWeeksAgo },
        status: { $nin: ['CANCELLED', 'REJECTED'] },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          weekday: { $dayOfWeek: '$createdAt' },
          itemName: '$items.name',
        },
        qty: { $sum: '$items.qty' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { qty: -1 } },
  ]);

  const byDayMap = new Map();
  for (const row of agg) {
    const dayLabel = WEEKDAY_NAMES[row._id.weekday] || 'Day';
    const entry = byDayMap.get(dayLabel) || {
      weekday: dayLabel,
      totalQty: 0,
      topItems: [],
    };
    entry.totalQty += row.qty;
    if (entry.topItems.length < 3) {
      entry.topItems.push({ name: row._id.itemName, qty: row.qty });
    }
    byDayMap.set(dayLabel, entry);
  }

  const weekdayStats = Array.from(byDayMap.values()).sort((a, b) => b.totalQty - a.totalQty);
  const result = await generateDemandForecastAdvice({
    branchId: String(branchId),
    weekdayStats,
  });

  res.status(200).json({
    success: true,
    data: {
      disabled: false,
      advice: result.advice,
      generatedByAi: result.generatedByAi,
      weekdayStats,
    },
  });
});

// GET /api/v1/admin/daily-summary & POST /api/v1/admin/daily-summary/generate
export const getLatestDailySummary = asyncHandler(async (req, res) => {
  const branchId = req.query.branchId || req.user.branchId;
  const latest = await DailySummary.findOne({ branchId }).sort({ date: -1 }).lean();
  res.status(200).json({ success: true, data: { summary: latest || null } });
});

export const triggerDailySummaryNow = asyncHandler(async (req, res) => {
  const branchId = req.body?.branchId || req.user.branchId;
  const saved = await buildAndSaveDailySummaryForBranch(branchId);
  res.status(200).json({ success: true, data: { summary: saved } });
});
