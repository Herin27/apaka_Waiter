import crypto from 'crypto';
import Razorpay from 'razorpay';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import {
  Branch,
  Coupon,
  Feedback,
  Order,
  Payment,
  Table,
  TableSession,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { calculateSessionBill, settleSessionIfPaid } from '../services/billing.service.js';
import { logActivity } from '../services/activityLog.service.js';
import { emitToBranch, emitToSession } from '../sockets/index.js';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const getBranchFilter = (req) => {
  if (req.user?.role === 'superadmin') {
    return req.query.branchId ? { branchId: req.query.branchId } : {};
  }
  return { branchId: req.user?.branchId };
};

const getRazorpayClient = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
};

// ==========================================
// 1. BILL & COUPON APPLICATION
// ==========================================

// GET /api/v1/sessions/:id/bill (Staff) or GET /api/v1/public/bill (Customer)
export const getSessionBill = asyncHandler(async (req, res, next) => {
  const sessionId = req.params.id || req.session?._id;
  if (!sessionId) return next(new ApiError(400, 'Session ID is required.'));

  const bill = await calculateSessionBill(sessionId);
  res.status(200).json({ success: true, data: { bill } });
});

// PATCH /api/v1/sessions/:id/tip or /api/v1/public/bill/tip
export const updateSessionTip = asyncHandler(async (req, res, next) => {
  const sessionId = req.params.id || req.session?._id;
  const tipAmount = Math.max(0, round2(req.body.tipAmount || 0));

  const session = await TableSession.findById(sessionId);
  if (!session) return next(new ApiError(404, 'Session not found.'));

  session.tipAmount = tipAmount;
  await session.save();

  const bill = await calculateSessionBill(sessionId);
  emitToSession(sessionId, 'bill:updated', { bill });
  emitToBranch(session.branchId, 'bill:updated', { bill });

  res.status(200).json({ success: true, data: { bill } });
});

// POST /api/v1/bill/apply-coupon (works for both staff { sessionId, code } and customer { code })
export const applyCouponToBill = asyncHandler(async (req, res, next) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const sessionId = req.body.sessionId || req.session?._id;

  if (!sessionId) return next(new ApiError(400, 'sessionId is required.'));
  if (!code) return next(new ApiError(400, 'Coupon code is required.'));

  const session = await TableSession.findById(sessionId);
  if (!session) return next(new ApiError(404, 'Table session not found.'));

  const coupon = await Coupon.findOne({
    branchId: session.branchId,
    code,
    isActive: true,
  });

  if (!coupon) {
    return next(new ApiError(404, `Invalid or inactive coupon code '${code}'.`));
  }

  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) {
    return next(new ApiError(400, 'This coupon is not active yet.'));
  }
  if (coupon.validUntil && now > new Date(coupon.validUntil)) {
    return next(new ApiError(400, 'This coupon has expired.'));
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return next(new ApiError(400, 'This coupon has reached its maximum usage limit.'));
  }

  const currentBill = await calculateSessionBill(sessionId);
  if (currentBill.subtotal < (coupon.minOrderAmount || 0)) {
    return next(
      new ApiError(
        400,
        `Minimum order subtotal of ₹${coupon.minOrderAmount} is required for '${coupon.code}'.`
      )
    );
  }

  let discountAmount = 0;
  if (coupon.discountType === 'PERCENT') {
    discountAmount = round2((currentBill.subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = round2(coupon.maxDiscountAmount);
    }
  } else {
    discountAmount = round2(Math.min(currentBill.subtotal, coupon.discountValue));
  }

  session.appliedCoupon = {
    couponId: coupon._id,
    code: coupon.code,
    discountAmount,
  };
  await session.save();

  const updatedBill = await calculateSessionBill(sessionId);
  emitToSession(sessionId, 'bill:updated', { bill: updatedBill });
  emitToBranch(session.branchId, 'bill:updated', { bill: updatedBill });

  res.status(200).json({
    success: true,
    data: {
      message: `Coupon '${coupon.code}' applied (-₹${discountAmount})`,
      bill: updatedBill,
    },
  });
});

// DELETE /api/v1/bill/remove-coupon
export const removeCouponFromBill = asyncHandler(async (req, res, next) => {
  const sessionId = req.body?.sessionId || req.query?.sessionId || req.session?._id;
  if (!sessionId) return next(new ApiError(400, 'sessionId is required.'));

  const session = await TableSession.findById(sessionId);
  if (!session) return next(new ApiError(404, 'Table session not found.'));

  session.appliedCoupon = { couponId: null, code: '', discountAmount: 0 };
  await session.save();

  const updatedBill = await calculateSessionBill(sessionId);
  res.status(200).json({ success: true, data: { bill: updatedBill } });
});

// ==========================================
// 2. COUPONS CRUD (ADMIN)
// ==========================================

export const listCoupons = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);
  const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: { count: coupons.length, coupons } });
});

export const createCoupon = asyncHandler(async (req, res, next) => {
  const branchId =
    req.user.role === 'superadmin' ? req.body.branchId || req.user.branchId : req.user.branchId;
  if (!branchId) return next(new ApiError(400, 'branchId is required.'));

  const coupon = await Coupon.create({
    ...req.body,
    branchId,
    code: req.body.code.trim().toUpperCase(),
  });

  await logActivity({
    branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'COUPON_CREATED',
    entityType: 'Coupon',
    entityId: coupon._id,
    details: { code: coupon.code },
  });

  res.status(201).json({ success: true, data: { coupon } });
});

export const updateCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!coupon) return next(new ApiError(404, 'Coupon not found.'));

  Object.assign(coupon, req.body);
  if (req.body.code) coupon.code = req.body.code.trim().toUpperCase();
  await coupon.save();

  res.status(200).json({ success: true, data: { coupon } });
});

export const deleteCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, ...getBranchFilter(req) });
  if (!coupon) return next(new ApiError(404, 'Coupon not found.'));

  await coupon.deleteOne();
  res.status(200).json({ success: true, data: { message: 'Coupon deleted.' } });
});

// ==========================================
// 3. CASHIER PAYMENTS (CASH / UPI / CARD / MIXED / PAY AT COUNTER)
// ==========================================

// GET /api/v1/payments/open-tables -> returns all tables with open sessions & live bill summaries
export const listOpenTablesWithBills = asyncHandler(async (req, res) => {
  const branchFilter = getBranchFilter(req);
  const openSessions = await TableSession.find({ ...branchFilter, status: 'OPEN' }).populate(
    'tableId',
    'name section status seats'
  );

  const enriched = [];
  for (const sess of openSessions) {
    const bill = await calculateSessionBill(sess._id);
    enriched.push({
      sessionId: sess._id,
      table: sess.tableId,
      guestsCount: sess.guests?.length || 1,
      startedAt: sess.startedAt,
      bill,
    });
  }

  res.status(200).json({
    success: true,
    data: {
      count: enriched.length,
      openTables: enriched,
    },
  });
});

// POST /api/v1/payments/record (Cashier records single or mixed payments: e.g. [{ method: 'CASH', amount: 500 }, { method: 'UPI', amount: 248 }])
export const recordCashierPayments = asyncHandler(async (req, res, next) => {
  const { sessionId, payments: paymentEntries, tipAmount, splitMeta } = req.body;

  const session = await TableSession.findOne({ _id: sessionId, ...getBranchFilter(req) });
  if (!session) return next(new ApiError(404, 'Table session not found.'));

  if (tipAmount !== undefined) {
    session.tipAmount = Math.max(0, round2(tipAmount));
    await session.save();
  }

  const currentBill = await calculateSessionBill(session._id);

  const createdPayments = [];
  for (const entry of paymentEntries) {
    const amt = round2(entry.amount);
    if (amt <= 0) continue;

    const p = await Payment.create({
      branchId: session.branchId,
      sessionId: session._id,
      tableId: session.tableId,
      orderIds: currentBill.orderIds,
      amount: amt,
      method: entry.method,
      status: 'COMPLETED',
      transactionRef: entry.transactionRef || '',
      splitMeta: splitMeta || { mode: 'FULL', label: '' },
      collectedBy: req.user._id,
      paidAt: new Date(),
    });
    createdPayments.push(p);
  }

  if (!createdPayments.length) {
    return next(new ApiError(400, 'At least one positive payment amount is required.'));
  }

  const settlement = await settleSessionIfPaid(
    session._id,
    `${req.user.name} (${req.user.role})`
  );

  await logActivity({
    branchId: session.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: 'PAYMENT_RECORDED',
    entityType: 'Payment',
    entityId: session._id,
    details: {
      methods: createdPayments.map((p) => `${p.method}:₹${p.amount}`),
      settled: settlement.settled,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      payments: createdPayments,
      settled: settlement.settled,
      bill: settlement.bill,
    },
  });
});

// POST /api/v1/public/payments/pay-at-counter (Customer chooses Pay at Counter / Cash)
export const customerPayAtCounter = asyncHandler(async (req, res) => {
  const { tipAmount, method = 'COUNTER' } = req.body;
  const session = await TableSession.findById(req.session._id);

  if (tipAmount !== undefined) {
    session.tipAmount = Math.max(0, round2(tipAmount));
    await session.save();
  }

  const table = await Table.findByIdAndUpdate(
    session.tableId,
    { status: 'NEEDS_BILL' },
    { new: true }
  );

  const bill = await calculateSessionBill(session._id);

  if (table) {
    emitToBranch(session.branchId, 'table:updated', { table });
  }
  emitToBranch(session.branchId, 'call:new', {
    call: {
      _id: `counter_${Date.now()}`,
      tableId: { _id: table._id, name: table.name },
      type: 'BILL',
      status: 'OPEN',
      note: `Customer requested ${method} settlement (₹${bill.balanceDue})`,
      createdAt: new Date().toISOString(),
    },
  });

  res.status(200).json({
    success: true,
    data: {
      message: 'Cashier & waiter notified for counter/cash settlement.',
      bill,
    },
  });
});

// ==========================================
// 4. RAZORPAY CHECKOUT & WEBHOOK
// ==========================================

// POST /api/v1/payments/razorpay/create-order (Customer or Cashier)
export const createRazorpayOrder = asyncHandler(async (req, res, next) => {
  const sessionId = req.body.sessionId || req.session?._id;
  const requestedAmount = req.body.amount ? round2(req.body.amount) : null;
  const tipAmount = req.body.tipAmount !== undefined ? round2(req.body.tipAmount) : null;

  if (!sessionId) return next(new ApiError(400, 'sessionId is required.'));

  const session = await TableSession.findById(sessionId);
  if (!session) return next(new ApiError(404, 'Table session not found.'));

  if (tipAmount !== null) {
    session.tipAmount = Math.max(0, tipAmount);
    await session.save();
  }

  const bill = await calculateSessionBill(session._id);
  const payableRupees = requestedAmount && requestedAmount > 0 ? requestedAmount : bill.balanceDue;

  if (payableRupees <= 0) {
    return next(new ApiError(400, 'No balance due on this bill.'));
  }

  const amountPaise = Math.round(payableRupees * 100);
  const rzp = getRazorpayClient();

  // If real Razorpay test keys are configured, create live Razorpay order; otherwise return simulated test order
  if (rzp) {
    const rzpOrder = await rzp.orders.create({
      amount: amountPaise,
      currency: bill.restaurant.currency || 'INR',
      receipt: `rcpt_${String(session._id).slice(-8)}_${Date.now()}`,
      notes: {
        sessionId: String(session._id),
        branchId: String(session.branchId),
        tableId: String(session.tableId),
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        keyId: env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        simulated: false,
        bill,
      },
    });
  }

  // Fallback test simulation when RAZORPAY_KEY_ID is placeholder
  const mockOrderId = `order_test_${Date.now()}`;
  return res.status(201).json({
    success: true,
    data: {
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_demo_key',
      razorpayOrderId: mockOrderId,
      amount: amountPaise,
      currency: 'INR',
      simulated: true,
      bill,
    },
  });
});

// POST /api/v1/payments/razorpay/verify
export const verifyRazorpayPayment = asyncHandler(async (req, res, next) => {
  const {
    sessionId: bodySessionId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount,
    splitMeta,
    simulated,
  } = req.body;

  const sessionId = bodySessionId || req.session?._id;
  if (!sessionId) return next(new ApiError(400, 'sessionId is required.'));

  const session = await TableSession.findById(sessionId);
  if (!session) return next(new ApiError(404, 'Table session not found.'));

  // Idempotency: if payment already recorded for this razorpay_payment_id, return it
  const existing = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
  if (existing) {
    const bill = await calculateSessionBill(session._id);
    return res.status(200).json({
      success: true,
      data: { payment: existing, settled: bill.isFullyPaid, bill },
    });
  }

  if (!simulated && env.RAZORPAY_KEY_SECRET) {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return next(new ApiError(400, 'Razorpay payment signature verification failed.'));
    }
  }

  const currentBill = await calculateSessionBill(session._id);
  const paidRupees = amount ? round2(amount) : currentBill.balanceDue;

  const payment = await Payment.create({
    branchId: session.branchId,
    sessionId: session._id,
    tableId: session.tableId,
    orderIds: currentBill.orderIds,
    amount: paidRupees,
    method: 'RAZORPAY',
    status: 'COMPLETED',
    transactionRef: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature || 'test_verified',
    splitMeta: splitMeta || { mode: 'FULL', label: '' },
    paidAt: new Date(),
  });

  const settlement = await settleSessionIfPaid(session._id, 'RAZORPAY_CHECKOUT');

  res.status(200).json({
    success: true,
    data: {
      payment,
      settled: settlement.settled,
      bill: settlement.bill,
    },
  });
});

// POST /api/v1/payments/razorpay/webhook (verifies X-Razorpay-Signature on rawBody, idempotent)
export const handleRazorpayWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;

  if (env.RAZORPAY_WEBHOOK_SECRET) {
    if (!signature || !rawBody) {
      return next(new ApiError(400, 'Missing webhook signature or raw payload.'));
    }
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expected !== signature) {
      return next(new ApiError(401, 'Invalid Razorpay webhook signature.'));
    }
  }

  const event = req.body?.event;
  if (event === 'payment.captured') {
    const entity = req.body?.payload?.payment?.entity;
    const rzpPaymentId = entity?.id;
    const rzpOrderId = entity?.order_id;
    const sessionId = entity?.notes?.sessionId;

    if (rzpPaymentId && sessionId) {
      const alreadyExists = await Payment.findOne({ razorpayPaymentId: rzpPaymentId });
      if (!alreadyExists) {
        const session = await TableSession.findById(sessionId);
        if (session) {
          const bill = await calculateSessionBill(session._id);
          await Payment.create({
            branchId: session.branchId,
            sessionId: session._id,
            tableId: session.tableId,
            orderIds: bill.orderIds,
            amount: round2((entity.amount || 0) / 100),
            method: 'RAZORPAY',
            status: 'COMPLETED',
            transactionRef: rzpPaymentId,
            razorpayOrderId: rzpOrderId || '',
            razorpayPaymentId: rzpPaymentId,
            paidAt: new Date(),
          });
          await settleSessionIfPaid(session._id, 'RAZORPAY_WEBHOOK');
        }
      }
    }
  }

  res.status(200).json({ success: true, data: { received: true } });
});

// ==========================================
// 5. REFUND / VOID (ADMIN APPROVAL REQUIRED)
// ==========================================

// POST /api/v1/payments/:id/refund
export const refundOrVoidPayment = asyncHandler(async (req, res, next) => {
  const { reason, action = 'REFUNDED' } = req.body;
  const payment = await Payment.findOne({ _id: req.params.id, ...getBranchFilter(req) });

  if (!payment) return next(new ApiError(404, 'Payment record not found.'));
  if (['REFUNDED', 'VOIDED'].includes(payment.status)) {
    return next(new ApiError(400, `Payment is already ${payment.status}.`));
  }

  payment.status = action === 'VOID' ? 'VOIDED' : 'REFUNDED';
  payment.refundReason = reason;
  payment.refundApprovedBy = req.user._id;
  payment.refundedAt = new Date();
  await payment.save();

  await logActivity({
    branchId: payment.branchId,
    userId: req.user._id,
    actorRole: req.user.role,
    action: `PAYMENT_${payment.status}`,
    entityType: 'Payment',
    entityId: payment._id,
    details: {
      amount: payment.amount,
      method: payment.method,
      reason,
      approvedBy: req.user.email,
    },
  });

  res.status(200).json({
    success: true,
    data: {
      message: `Payment ${payment.status.toLowerCase()} successfully.`,
      payment,
    },
  });
});

// GET /api/v1/payments (List recent payments for cashier/admin)
export const listPayments = asyncHandler(async (req, res) => {
  const filter = getBranchFilter(req);
  if (req.query.status) filter.status = req.query.status;

  const payments = await Payment.find(filter)
    .populate('tableId', 'name')
    .populate('collectedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({ success: true, data: { count: payments.length, payments } });
});

// ==========================================
// 6. INVOICE PDF & 58/80mm THERMAL HTML BILL
// ==========================================

// GET /api/v1/sessions/:id/invoice.pdf
export const downloadSessionInvoicePdf = asyncHandler(async (req, res) => {
  const bill = await calculateSessionBill(req.params.id);
  const invoiceNumber = bill.invoiceNo || `PROFORMA-${String(bill.sessionId).slice(-6).toUpperCase()}`;

  const doc = new PDFDocument({ size: 'A4', margin: 42 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111111').text(bill.restaurant.name);
  doc.fontSize(10).font('Helvetica').fillColor('#444444').text(bill.branch.name);
  if (bill.branch.address) doc.text(bill.branch.address);
  if (bill.restaurant.gstin) doc.text(`GSTIN: ${bill.restaurant.gstin}`);
  if (bill.restaurant.fssai) doc.text(`FSSAI: ${bill.restaurant.fssai}`);

  doc.moveDown(0.8);
  doc
    .moveTo(42, doc.y)
    .lineTo(553, doc.y)
    .strokeColor('#E8591A')
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);

  // Invoice Meta
  const metaY = doc.y;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111111').text(`TAX INVOICE: ${invoiceNumber}`, 42, metaY);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#333333')
    .text(`Date: ${new Date().toLocaleString('en-IN')}`, 340, metaY, { align: 'right' });
  doc.text(`Table: ${bill.table.name} (${bill.table.section || 'Dine-In'})`, 42, metaY + 16);
  doc.text(
    `Payment Mode: ${
      bill.payments.length > 0
        ? Array.from(new Set(bill.payments.map((p) => p.method))).join(' + ')
        : 'PENDING'
    }`,
    340,
    metaY + 16,
    { align: 'right' }
  );

  doc.moveDown(1.8);

  // Table Headers
  const tableTop = doc.y;
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111111');
  doc.text('ITEM DESCRIPTION', 42, tableTop);
  doc.text('QTY', 330, tableTop, { width: 45, align: 'right' });
  doc.text('RATE', 385, tableTop, { width: 70, align: 'right' });
  doc.text('AMOUNT', 465, tableTop, { width: 88, align: 'right' });

  doc
    .moveTo(42, tableTop + 14)
    .lineTo(553, tableTop + 14)
    .strokeColor('#CCCCCC')
    .lineWidth(0.8)
    .stroke();

  let rowY = tableTop + 22;
  doc.font('Helvetica').fontSize(9.5).fillColor('#222222');

  for (const item of bill.items) {
    if (rowY > 680) {
      doc.addPage();
      rowY = 50;
    }
    const label = `${item.name}${item.variant ? ` (${item.variant})` : ''}`;
    doc.text(label, 42, rowY, { width: 280 });
    doc.text(String(item.qty), 330, rowY, { width: 45, align: 'right' });
    doc.text(`₹${item.unitPrice.toFixed(2)}`, 385, rowY, { width: 70, align: 'right' });
    doc.text(`₹${item.lineTotal.toFixed(2)}`, 465, rowY, { width: 88, align: 'right' });
    rowY += 18;
  }

  doc
    .moveTo(42, rowY + 4)
    .lineTo(553, rowY + 4)
    .strokeColor('#CCCCCC')
    .lineWidth(0.8)
    .stroke();

  rowY += 14;

  const drawSummaryRow = (label, value, bold = false, accent = false) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 11 : 9.5)
      .fillColor(accent ? '#E8591A' : '#111111');
    doc.text(label, 310, rowY, { width: 150, align: 'right' });
    doc.text(value, 465, rowY, { width: 88, align: 'right' });
    rowY += bold ? 18 : 15;
  };

  drawSummaryRow('Subtotal:', `₹${bill.subtotal.toFixed(2)}`);
  if (bill.discount > 0) {
    drawSummaryRow(`Discount (${bill.coupon?.code || 'PROMO'}):`, `-₹${bill.discount.toFixed(2)}`);
  }
  drawSummaryRow(`CGST (${bill.cgstPercent}%):`, `₹${bill.cgst.toFixed(2)}`);
  drawSummaryRow(`SGST (${bill.sgstPercent}%):`, `₹${bill.sgst.toFixed(2)}`);
  if (bill.serviceCharge > 0) {
    drawSummaryRow(`Service Charge (${bill.serviceChargePercent}%):`, `₹${bill.serviceCharge.toFixed(2)}`);
  }
  if (bill.tip > 0) {
    drawSummaryRow('Tip:', `₹${bill.tip.toFixed(2)}`);
  }
  if (bill.roundOff !== 0) {
    drawSummaryRow('Round Off:', `₹${bill.roundOff.toFixed(2)}`);
  }
  drawSummaryRow('GRAND TOTAL:', `₹${bill.grandTotal.toFixed(2)}`, true, true);
  drawSummaryRow('Paid Amount:', `₹${bill.paidAmount.toFixed(2)}`);
  drawSummaryRow('Balance Due:', `₹${bill.balanceDue.toFixed(2)}`, true);

  // Mandatory Footer Credit
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#666666')
    .text('Designed & Developed by HeryxStudio', 42, doc.page.height - 42, {
      width: 511,
      align: 'center',
    });

  doc.end();
});

// GET /api/v1/sessions/:id/thermal-bill?width=80 (58mm or 80mm thermal HTML receipt)
export const getThermalHtmlBill = asyncHandler(async (req, res) => {
  const bill = await calculateSessionBill(req.params.id);
  const widthMm = req.query.width === '58' ? '58mm' : '80mm';
  const invoiceNumber = bill.invoiceNo || `BILL-${String(bill.sessionId).slice(-6).toUpperCase()}`;

  const itemsHtml = bill.items
    .map(
      (i) => `
      <tr>
        <td style="padding:3px 0;">${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ''}</td>
        <td style="text-align:right;padding:3px 0;">₹${i.lineTotal.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invoiceNumber}</title>
  <style>
    @page { size: ${widthMm} auto; margin: 2mm; }
    body {
      width: ${widthMm};
      margin: 0 auto;
      padding: 6px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    .bold { font-weight: bold; }
  </style>
</head>
<body onload="window.print()">
  <div class="center">
    <div class="bold" style="font-size:14px;">${bill.restaurant.name}</div>
    <div>${bill.branch.name}</div>
    ${bill.restaurant.gstin ? `<div>GSTIN: ${bill.restaurant.gstin}</div>` : ''}
  </div>
  <div class="line"></div>
  <div>Bill: ${invoiceNumber}</div>
  <div>Table: ${bill.table.name} | ${new Date().toLocaleString('en-IN')}</div>
  <div class="line"></div>
  <table>${itemsHtml}</table>
  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right;">₹${bill.subtotal.toFixed(2)}</td></tr>
    ${bill.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-₹${bill.discount.toFixed(2)}</td></tr>` : ''}
    <tr><td>CGST (${bill.cgstPercent}%)</td><td style="text-align:right;">₹${bill.cgst.toFixed(2)}</td></tr>
    <tr><td>SGST (${bill.sgstPercent}%)</td><td style="text-align:right;">₹${bill.sgst.toFixed(2)}</td></tr>
    ${bill.serviceCharge > 0 ? `<tr><td>Service Charge</td><td style="text-align:right;">₹${bill.serviceCharge.toFixed(2)}</td></tr>` : ''}
    ${bill.tip > 0 ? `<tr><td>Tip</td><td style="text-align:right;">₹${bill.tip.toFixed(2)}</td></tr>` : ''}
    <tr class="bold" style="font-size:14px;"><td>TOTAL</td><td style="text-align:right;">₹${bill.grandTotal.toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>
  <div class="center" style="font-size:10px;">
    <div>Thank you for dining with us!</div>
    <div class="bold" style="margin-top:4px;">Designed &amp; Developed by HeryxStudio</div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

// ==========================================
// 7. Z-REPORT (END-OF-DAY SUMMARY)
// ==========================================

// GET /api/v1/reports/z-report?date=YYYY-MM-DD
export const getZReport = asyncHandler(async (req, res) => {
  const branchFilter = getBranchFilter(req);
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);

  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);

  const [orders, payments] = await Promise.all([
    Order.find({
      ...branchFilter,
      createdAt: { $gte: start, $lte: end },
    }).lean(),
    Payment.find({
      ...branchFilter,
      paidAt: { $gte: start, $lte: end },
    }).lean(),
  ]);

  const validOrders = orders.filter((o) => !['CANCELLED', 'REJECTED'].includes(o.status));
  const cancelledOrders = orders.filter((o) => ['CANCELLED', 'REJECTED'].includes(o.status));

  const grossSales = round2(validOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0));
  const taxCollected = round2(validOrders.reduce((s, o) => s + Number(o.tax || 0), 0));
  const serviceChargeCollected = round2(
    validOrders.reduce((s, o) => s + Number(o.serviceCharge || 0), 0)
  );
  const discountsGiven = round2(validOrders.reduce((s, o) => s + Number(o.discount || 0), 0));

  const byMethod = {};
  let totalCollected = 0;
  let totalRefunded = 0;
  let tipsCollected = 0;

  for (const p of payments) {
    if (p.status === 'COMPLETED') {
      totalCollected = round2(totalCollected + Number(p.amount || 0));
      tipsCollected = round2(tipsCollected + Number(p.tipAmount || 0));
      byMethod[p.method] = round2((byMethod[p.method] || 0) + Number(p.amount || 0));
    } else if (['REFUNDED', 'VOIDED'].includes(p.status)) {
      totalRefunded = round2(totalRefunded + Number(p.amount || 0));
    }
  }

  res.status(200).json({
    success: true,
    data: {
      date: dateStr,
      ordersCount: validOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      grossSales,
      taxCollected,
      cgstCollected: round2(taxCollected / 2),
      sgstCollected: round2(taxCollected - round2(taxCollected / 2)),
      serviceChargeCollected,
      discountsGiven,
      tipsCollected,
      totalCollected,
      totalRefunded,
      netRevenue: round2(totalCollected - totalRefunded),
      byPaymentMethod: byMethod,
    },
  });
});

// ==========================================
// 8. CUSTOMER FEEDBACK (EMITS feedback:low ON <= 3 STARS)
// ==========================================

// POST /api/v1/public/feedback
export const submitCustomerFeedback = asyncHandler(async (req, res) => {
  const { rating, foodRating, serviceRating, comment } = req.body;
  const session = await TableSession.findById(req.session._id).populate('tableId', 'name');

  const feedback = await Feedback.create({
    branchId: session.branchId,
    sessionId: session._id,
    tableId: session.tableId?._id || session.tableId,
    rating: Number(rating),
    foodRating: foodRating ? Number(foodRating) : Number(rating),
    serviceRating: serviceRating ? Number(serviceRating) : Number(rating),
    comment: comment || '',
    guestName: req.guest?.nickname || 'Guest',
  });

  if (Number(rating) <= 3) {
    emitToBranch(session.branchId, 'feedback:low', {
      feedback,
      tableName: session.tableId?.name || 'Table',
    });
  }

  res.status(201).json({
    success: true,
    data: {
      message: 'Thank you for your feedback!',
      feedback,
    },
  });
});
