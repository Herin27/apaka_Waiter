import { Counter } from '../models/Counter.js';

export const generateOrderNo = async (branchId) => {
  const today = new Date().toISOString().slice(0, 10);
  const key = `order:${branchId}:${today}`;

  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `A-${counter.seq}`;
};
