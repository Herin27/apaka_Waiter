import cron from 'node-cron';
import {
  Branch,
  DailySummary,
  Feedback,
  Order,
  Payment,
  Restaurant,
} from '../models/index.js';
import { generateDailyOwnerSummaryText } from './gemini.service.js';
import { emitToBranch } from '../sockets/index.js';

let scheduledTask = null;

export const buildAndSaveDailySummaryForBranch = async (branchId, targetDate = new Date()) => {
  const branch = await Branch.findById(branchId);
  if (!branch) return null;

  const restaurant = await Restaurant.findById(branch.restaurantId);
  if (restaurant?.settings?.aiFeatures?.dailyOwnerSummary === false) {
    return null;
  }

  const dateStr = targetDate.toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);

  const [orders, payments, feedbacks] = await Promise.all([
    Order.find({
      branchId: branch._id,
      createdAt: { $gte: start, $lte: end },
      status: { $nin: ['CANCELLED', 'REJECTED'] },
    }).lean(),
    Payment.find({
      branchId: branch._id,
      status: 'COMPLETED',
      paidAt: { $gte: start, $lte: end },
    }).lean(),
    Feedback.find({
      branchId: branch._id,
      createdAt: { $gte: start, $lte: end },
    }).lean(),
  ]);

  const revenue =
    Math.round(
      (payments.reduce((s, p) => s + Number(p.amount || 0), 0) + Number.EPSILON) * 100
    ) / 100;

  const itemCounts = new Map();
  let lateOrdersCount = 0;

  for (const ord of orders) {
    for (const it of ord.items || []) {
      itemCounts.set(it.name, (itemCounts.get(it.name) || 0) + it.qty);
    }
    const confEv = (ord.events || []).find((e) => e.to === 'CONFIRMED');
    const servedEv = (ord.events || []).find((e) => e.to === 'SERVED');
    if (confEv && servedEv) {
      const mins = (new Date(servedEv.at) - new Date(confEv.at)) / 60000;
      if (mins > 25) lateOrdersCount++;
    }
  }

  const bestSellers = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, qty]) => `${name} (${qty})`);

  const lowRatingsCount = feedbacks.filter((f) => Number(f.rating) <= 3).length;

  const metrics = {
    revenue,
    ordersCount: orders.length,
    bestSellers,
    lateOrdersCount,
    lowRatingsCount,
  };

  const { summaryText, generatedByAi } = await generateDailyOwnerSummaryText({
    dateStr,
    metrics,
  });

  const saved = await DailySummary.findOneAndUpdate(
    { branchId: branch._id, date: dateStr },
    {
      $set: {
        summaryText,
        metrics,
        generatedByAi,
      },
    },
    { upsert: true, new: true }
  );

  emitToBranch(branch._id, 'summary:daily', { summary: saved });
  return saved;
};

export const startDailySummaryScheduler = () => {
  if (scheduledTask) return;
  // Run every day at 23:00 (11:00 PM)
  scheduledTask = cron.schedule('0 23 * * *', async () => {
    try {
      const branches = await Branch.find({ isActive: true }).select('_id').lean();
      for (const b of branches) {
        await buildAndSaveDailySummaryForBranch(b._id);
      }
      console.log('🌙 Daily 11 PM owner summaries generated');
    } catch (err) {
      console.error('⚠️ Daily summary cron error:', err.message);
    }
  });
  console.log('🌙 Daily owner summary cron scheduled for 11:00 PM daily');
};
