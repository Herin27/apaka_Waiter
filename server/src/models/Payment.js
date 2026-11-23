import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
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
    },
    orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    amount: { type: Number, required: true, min: 0 },
    tipAmount: { type: Number, default: 0, min: 0 },
    method: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'ONLINE', 'RAZORPAY', 'COUNTER', 'SPLIT'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUND_REQUESTED', 'REFUNDED', 'VOIDED'],
      default: 'COMPLETED',
    },
    transactionRef: { type: String, default: '' },
    razorpayOrderId: { type: String, default: '', index: true },
    razorpayPaymentId: { type: String, default: '', index: true },
    razorpaySignature: { type: String, default: '' },
    splitMeta: {
      mode: { type: String, enum: ['FULL', 'EQUAL', 'BY_ITEM', 'BY_GUEST'], default: 'FULL' },
      label: { type: String, default: '' },
    },
    refundReason: { type: String, default: '' },
    refundApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    refundedAt: { type: Date, default: null },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
