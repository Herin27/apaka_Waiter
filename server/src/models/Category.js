import mongoose from 'mongoose';

const localizedStringSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    hi: { type: String, trim: true, default: '' },
    gu: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    name: { type: localizedStringSchema, required: true },
    sortOrder: { type: Number, default: 0 },
    station: {
      type: String,
      enum: ['KITCHEN', 'BAR', 'PASTRY'],
      default: 'KITCHEN',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ branchId: 1, sortOrder: 1 });

export const Category = mongoose.model('Category', categorySchema);
