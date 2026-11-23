import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['RESTOCK', 'ORDER_DEDUCT', 'WASTAGE', 'ADJUSTMENT'],
      required: true,
    },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: '' },
    by: { type: String, default: 'SYSTEM' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ingredientSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    unit: { type: String, enum: ['kg', 'g', 'l', 'ml', 'pcs'], required: true },
    currentStock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    linkedMenuItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
    movements: { type: [stockMovementSchema], default: [] },
  },
  { timestamps: true }
);

ingredientSchema.index({ branchId: 1, name: 1 }, { unique: true });

export const Ingredient = mongoose.model('Ingredient', ingredientSchema);
