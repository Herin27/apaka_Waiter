import { Branch, Order, Restaurant, Table } from '../models/index.js';
import { emitToBranch, emitToSession } from '../sockets/index.js';
import { assertValidOrderTransition } from './orderStateMachine.service.js';

let intervalRef = null;

export const runAutoConfirmTick = async () => {
  try {
    const restaurants = await Restaurant.find({ 'settings.autoConfirmSeconds': { $gt: 0 } }).lean();
    if (!restaurants.length) return;

    for (const restaurant of restaurants) {
      const autoSeconds = restaurant.settings.autoConfirmSeconds;
      const cutoff = new Date(Date.now() - autoSeconds * 1000);

      const branches = await Branch.find({ restaurantId: restaurant._id, isActive: true })
        .select('_id')
        .lean();
      if (!branches.length) continue;

      const branchIds = branches.map((b) => b._id);

      const stalePlacedOrders = await Order.find({
        branchId: { $in: branchIds },
        status: 'PLACED',
        createdAt: { $lte: cutoff },
      });

      for (const order of stalePlacedOrders) {
        try {
          assertValidOrderTransition({
            currentStatus: order.status,
            nextStatus: 'CONFIRMED',
            actorRole: 'SYSTEM',
          });

          const prevStatus = order.status;
          order.status = 'CONFIRMED';
          order.items.forEach((item) => {
            if (item.status === 'PLACED') item.status = 'CONFIRMED';
          });
          order.events.push({
            from: prevStatus,
            to: 'CONFIRMED',
            by: 'AUTO_CONFIRM_SYSTEM',
            at: new Date(),
            reason: `Auto-confirmed after ${autoSeconds}s`,
          });

          await order.save();

          const table = await Table.findByIdAndUpdate(
            order.tableId,
            { status: 'WAITING' },
            { new: true }
          );

          emitToBranch(order.branchId, 'order:updated', { order });
          emitToSession(order.sessionId, 'order:updated', { order });
          if (table) {
            emitToBranch(order.branchId, 'table:updated', { table });
          }

          console.log(`⏱️ Auto-confirmed order ${order.orderNo}`);
        } catch (err) {
          console.error(`⚠️ Auto-confirm skipped for ${order.orderNo}: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Auto-confirm scheduler tick error:', error.message);
  }
};

export const startAutoConfirmScheduler = () => {
  if (intervalRef) return;
  intervalRef = setInterval(runAutoConfirmTick, 10 * 1000);
  console.log('⏱️ Auto-confirm order scheduler started (10s interval)');
};
