import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
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
    rating: { type: Number, required: true, min: 1, max: 5 },
    foodRating: { type: Number, min: 1, max: 5 },
    serviceRating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '' },
    guestName: { type: String, trim: true, default: 'Guest' },
    adminReply: { type: String, trim: true, default: '' },
    repliedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model('Feedback', feedbackSchema);
