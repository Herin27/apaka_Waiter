import mongoose from 'mongoose';

const dailySummarySchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    date: { type: String, required: true }, // YYYY-MM-DD
    summaryText: { type: String, required: true },
    metrics: {
      revenue: { type: Number, default: 0 },
      ordersCount: { type: Number, default: 0 },
      bestSellers: { type: [String], default: [] },
      lateOrdersCount: { type: Number, default: 0 },
      lowRatingsCount: { type: Number, default: 0 },
    },
    generatedByAi: { type: Boolean, default: false },
  },
  { timestamps: true }
);

dailySummarySchema.index({ branchId: 1, date: 1 }, { unique: true });

export const DailySummary = mongoose.model('DailySummary', dailySummarySchema);
