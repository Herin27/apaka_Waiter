import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    seats: { type: Number, default: 4, min: 1 },
    shape: { type: String, enum: ['SQUARE', 'ROUND', 'RECTANGLE'], default: 'SQUARE' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    section: { type: String, default: 'Main Hall' },
    qrToken: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['EMPTY', 'SEATED', 'ORDERING', 'WAITING', 'PREPARING', 'READY', 'NEEDS_BILL', 'NEEDS_HELP'],
      default: 'EMPTY',
    },
  },
  { timestamps: true }
);

tableSchema.index({ branchId: 1, name: 1 }, { unique: true });

export const Table = mongoose.model('Table', tableSchema);
