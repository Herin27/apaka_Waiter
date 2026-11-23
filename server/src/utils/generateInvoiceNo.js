import { Counter } from '../models/Counter.js';

export const generateInvoiceNo = async (branchId) => {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `invoice:${branchId}:${ym}`;

  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `INV-${ym}-${String(counter.seq).padStart(4, '0')}`;
};
