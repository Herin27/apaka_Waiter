import { Order } from '../models/index.js';
import { emitToBranch } from '../sockets/index.js';

const SLA_MINUTES = {
  PLACED: 5,
  CONFIRMED: 8,
  PREPARING: 15,
};

const alertedKeys = new Set();
let timerRef = null;

export const runLateOrderCheck = async () => {
  try {
    const activeOrders = await Order.find({
      status: { $in: ['PLACED', 'CONFIRMED', 'PREPARING'] },
    }).populate('tableId', 'name');

    const now = Date.now();
    for (const order of activeOrders) {
      const slaMin = SLA_MINUTES[order.status] || 15;
      const ageMin = (now - new Date(order.createdAt).getTime()) / 60000;
      const alertKey = `${order._id}:${order.status}`;

      if (ageMin > slaMin && !alertedKeys.has(alertKey)) {
        alertedKeys.add(alertKey);
        emitToBranch(order.branchId, 'order:late', {
          orderId: order._id,
          orderNo: order.orderNo,
          tableName: order.tableId?.name || 'Table',
          status: order.status,
          elapsedMinutes: Math.floor(ageMin),
        });
      }
    }
  } catch (err) {
    console.error('⚠️ Late order SLA check error:', err.message);
  }
};

export const startLateOrderScheduler = () => {
  if (timerRef) return;
  timerRef = setInterval(runLateOrderCheck, 30 * 1000);
  console.log('🚨 Late-order SLA alert scheduler started (30s interval)');
};
