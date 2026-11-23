import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: { type: String, trim: true, default: '' },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    points: { type: Number, default: 0, min: 0 },
    tier: {
      type: String,
      enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      default: 'BRONZE',
    },
    visitCount: { type: Number, default: 1 },
    totalSpent: { type: Number, default: 0 },
    lastVisitAt: { type: Date, default: Date.now },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

customerSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });

export const Customer = mongoose.model('Customer', customerSchema);
