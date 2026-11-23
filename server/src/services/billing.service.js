import {
  Branch,
  Coupon,
  Order,
  Payment,
  Restaurant,
  Table,
  TableSession,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { generateInvoiceNo } from '../utils/generateInvoiceNo.js';
import { emitToBranch, emitToSession } from '../sockets/index.js';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const calculateSessionBill = async (sessionId, options = {}) => {
  const session = await TableSession.findById(sessionId)
    .populate('tableId', 'name section')
    .populate('branchId');

  if (!session) {
    throw new ApiError(404, 'Table session not found.');
  }

  const branch = await Branch.findById(session.branchId._id || session.branchId);
  const restaurant = await Restaurant.findById(branch.restaurantId);

  const orders = await Order.find({
    sessionId: session._id,
    status: { $nin: ['CANCELLED', 'REJECTED'] },
  }).sort({ createdAt: 1 });

  const payments = await Payment.find({
    sessionId: session._id,
    status: 'COMPLETED',
  }).sort({ paidAt: 1 });

  // Flatten billable items
  const items = [];
  let subtotal = 0;

  for (const ord of orders) {
    for (const item of ord.items) {
      if (['CANCELLED', 'REJECTED'].includes(item.status)) continue;
      const lineTotal = round2(item.price * item.qty);
      subtotal += lineTotal;
      items.push({
        orderId: ord._id,
        orderNo: ord.orderNo,
        itemId: item._id,
        menuItemId: item.menuItemId,
        name: item.name,
        variant: item.variant?.name || '',
        addons: (item.addons || []).map((a) => a.name),
        qty: item.qty,
        unitPrice: item.price,
        lineTotal,
        addedByGuest: item.addedByGuest || 'Guest',
      });
    }
  }

  subtotal = round2(subtotal);

  // Re-evaluate coupon if applied
  let discount = 0;
  let couponInfo = null;

  if (session.appliedCoupon?.code) {
    const coupon = await Coupon.findOne({
      branchId: branch._id,
      code: session.appliedCoupon.code,
      isActive: true,
    });

    if (coupon && subtotal >= (coupon.minOrderAmount || 0)) {
      if (coupon.discountType === 'PERCENT') {
        discount = round2((subtotal * coupon.discountValue) / 100);
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
          discount = round2(coupon.maxDiscountAmount);
        }
      } else {
        discount = round2(Math.min(subtotal, coupon.discountValue));
      }
      couponInfo = {
        couponId: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
      };
    }
  }

  const taxableAmount = Math.max(0, round2(subtotal - discount));
  const taxPercent = restaurant?.settings?.taxPercent ?? 5;
  const serviceChargePercent = restaurant?.settings?.serviceChargePercent ?? 0;

  const totalGst = round2((taxableAmount * taxPercent) / 100);
  const cgstPercent = round2(taxPercent / 2);
  const sgstPercent = round2(taxPercent / 2);
  const cgst = round2(totalGst / 2);
  const sgst = round2(totalGst - cgst);

  const serviceCharge = round2((taxableAmount * serviceChargePercent) / 100);
  const tip = round2(
    options.overrideTip !== undefined ? options.overrideTip : session.tipAmount || 0
  );

  const rawTotal = round2(taxableAmount + totalGst + serviceCharge + tip);
  const grandTotal = Math.round(rawTotal);
  const roundOff = round2(grandTotal - rawTotal);

  const paidAmount = round2(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const balanceDue = Math.max(0, round2(grandTotal - paidAmount));

  // Group summaries for Split by Guest
  const guestMap = new Map();
  for (const item of items) {
    const gName = item.addedByGuest || 'Guest';
    const curr = guestMap.get(gName) || { guest: gName, itemSubtotal: 0, items: [] };
    curr.itemSubtotal = round2(curr.itemSubtotal + item.lineTotal);
    curr.items.push(item);
    guestMap.set(gName, curr);
  }

  const ratio = subtotal > 0 ? grandTotal / subtotal : 1;
  const guestSplits = Array.from(guestMap.values()).map((g) => ({
    ...g,
    estimatedShare: round2(g.itemSubtotal * ratio),
  }));

  return {
    sessionId: session._id,
    sessionStatus: session.status,
    invoiceNo: session.invoiceNo || '',
    restaurant: {
      name: restaurant?.name || 'Aapka Waiter',
      gstin: restaurant?.gstin || '',
      fssai: restaurant?.fssai || '',
      currency: restaurant?.currency || 'INR',
      logo: restaurant?.logo || '',
    },
    branch: {
      id: branch._id,
      name: branch.name,
      address: branch.address,
    },
    table: {
      id: session.tableId?._id || session.tableId,
      name: session.tableId?.name || 'Table',
      section: session.tableId?.section || '',
    },
    ordersCount: orders.length,
    orderIds: orders.map((o) => o._id),
    items,
    guestSplits,
    subtotal,
    discount,
    coupon: couponInfo,
    taxableAmount,
    taxPercent,
    cgstPercent,
    sgstPercent,
    cgst,
    sgst,
    totalTax: totalGst,
    serviceChargePercent,
    serviceCharge,
    tip,
    roundOff,
    grandTotal,
    paidAmount,
    balanceDue,
    isFullyPaid: grandTotal > 0 ? balanceDue <= 0.01 : orders.length > 0,
    payments,
  };
};

export const settleSessionIfPaid = async (sessionId, actorLabel = 'SYSTEM') => {
  const bill = await calculateSessionBill(sessionId);
  if (!bill.isFullyPaid) {
    return { settled: false, bill };
  }

  const session = await TableSession.findById(sessionId);
  if (!session) return { settled: false, bill };

  if (!session.invoiceNo) {
    session.invoiceNo = await generateInvoiceNo(session.branchId);
  }

  if (session.status !== 'CLOSED') {
    session.status = 'CLOSED';
    session.closedAt = new Date();
    session.cart = [];
  }
  await session.save();

  // Increment coupon usage count if a coupon was used
  if (session.appliedCoupon?.couponId) {
    await Coupon.findByIdAndUpdate(session.appliedCoupon.couponId, {
      $inc: { usedCount: 1 },
    });
  }

  // Mark all active orders as PAID
  const orders = await Order.find({
    sessionId: session._id,
    status: { $nin: ['CANCELLED', 'REJECTED', 'PAID'] },
  });

  for (const order of orders) {
    const prev = order.status;
    order.status = 'PAID';
    order.items.forEach((item) => {
      if (!['CANCELLED', 'REJECTED'].includes(item.status)) {
        item.status = 'PAID';
      }
    });
    order.events.push({
      from: prev,
      to: 'PAID',
      by: actorLabel,
      at: new Date(),
      reason: `Bill settled (${session.invoiceNo})`,
    });
    await order.save();

    const populated = await Order.findById(order._id).populate('tableId', 'name section');
    emitToBranch(order.branchId, 'order:updated', { order: populated });
    emitToSession(order.sessionId, 'order:updated', { order: populated });
  }

  // Reset primary & merged tables to EMPTY
  const tableIds = [session.tableId, ...(session.mergedTableIds || [])];
  await Table.updateMany({ _id: { $in: tableIds } }, { $set: { status: 'EMPTY' } });

  const updatedTables = await Table.find({ _id: { $in: tableIds } });
  for (const tbl of updatedTables) {
    emitToBranch(session.branchId, 'table:updated', { table: tbl });
  }

  const refreshedBill = await calculateSessionBill(sessionId);
  emitToBranch(session.branchId, 'bill:paid', { sessionId: session._id, bill: refreshedBill });
  emitToSession(session._id, 'bill:paid', { sessionId: session._id, bill: refreshedBill });

  return { settled: true, bill: refreshedBill };
};
