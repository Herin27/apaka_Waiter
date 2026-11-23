import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    gstin: { type: String, trim: true, default: '' },
    fssai: { type: String, trim: true, default: '' },
    currency: { type: String, default: 'INR' },
    settings: {
      taxPercent: { type: Number, default: 5, min: 0, max: 100 },
      serviceChargePercent: { type: Number, default: 0, min: 0, max: 100 },
      autoConfirmSeconds: { type: Number, default: 0, min: 0 },
      receiptFooter: { type: String, default: 'Thank you for dining with us!' },
      geofence: {
        enabled: { type: Boolean, default: false },
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
        radiusMeters: { type: Number, default: 100 },
      },
      languages: {
        type: [String],
        default: ['en', 'hi', 'gu'],
      },
      aiFeatures: {
        voiceOrdering: { type: Boolean, default: true },
        recommendations: { type: Boolean, default: true },
        waitTimePrediction: { type: Boolean, default: true },
        demandForecast: { type: Boolean, default: true },
        dailyOwnerSummary: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

export const Restaurant = mongoose.model('Restaurant', restaurantSchema);
