import mongoose from 'mongoose';

const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
  'PAID',
  'REJECTED',
  'CANCELLED',
];

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    variant: {
      name: { type: String },
      price: { type: Number },
    },
    addons: [
      {
        name: { type: String },
        price: { type: Number },
      },
    ],
    note: { type: String, default: '' },
    station: {
      type: String,
      enum: ['KITCHEN', 'BAR', 'PASTRY'],
      default: 'KITCHEN',
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'PLACED',
    },
    addedByGuest: { type: String, default: 'Guest' },
  },
  { _id: true }
);

const orderEventSchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    by: { type: String, default: 'SYSTEM' },
    at: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TableSession',
      required: true,
      index: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    orderNo: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'PLACED',
      index: true,
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, required: true },
    rejectReason: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    events: { type: [orderEventSchema], default: [] },
    placedBy: {
      type: String,
      enum: ['CUSTOMER', 'WAITER'],
      default: 'CUSTOMER',
    },
  },
  { timestamps: true }
);

orderSchema.index({ sessionId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ branchId: 1, status: 1, createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);
