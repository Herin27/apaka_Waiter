import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    restaurantName: { type: String, required: true, trim: true },
    tablesCount: { type: Number, default: 10 },
    planInterest: { type: String, enum: ['STARTER', 'GROWTH', 'ENTERPRISE'], default: 'GROWTH' },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['NEW', 'CONTACTED', 'CONVERTED'], default: 'NEW' },
  },
  { timestamps: true }
);

export const Lead = mongoose.model('Lead', leadSchema);
