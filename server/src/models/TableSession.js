import mongoose from 'mongoose';

const guestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    nickname: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
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
    addedByGuest: { type: String, default: 'Guest' },
    addedByGuestId: { type: String, default: '' },
  },
  { _id: true }
);

const tableSessionSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    mergedTableIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Table' }],
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    guests: { type: [guestSchema], default: [] },
    cart: { type: [cartItemSchema], default: [] },
    appliedCoupon: {
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
      code: { type: String, default: '' },
      discountAmount: { type: Number, default: 0 },
    },
    loyaltyPointsRedeemed: { type: Number, default: 0, min: 0 },
    loyaltyDiscountAmount: { type: Number, default: 0, min: 0 },
    tipAmount: { type: Number, default: 0, min: 0 },
    invoiceNo: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tableSessionSchema.index({ tableId: 1, status: 1 });

export const TableSession = mongoose.model('TableSession', tableSessionSchema);
