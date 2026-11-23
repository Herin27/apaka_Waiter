import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    address: { type: String, default: '' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    openingHours: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Branch = mongoose.model('Branch', branchSchema);
