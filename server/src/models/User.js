import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'waiter', 'kitchen', 'cashier'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    assignedTables: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Table' }],
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
