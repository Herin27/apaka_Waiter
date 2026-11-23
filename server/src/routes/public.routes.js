import { Router } from 'express';
import {
  getPublicMenuByQr,
  startTableSession,
  renameSessionGuest,
  getSessionCart,
  addToSessionCart,
  updateSessionCartItem,
  removeSessionCartItem,
  placeCustomerOrder,
  listCustomerOrders,
  getCustomerOrderTracker,
  createCustomerWaiterCall,
} from '../controllers/public.controller.js';
import {
  getSessionBill,
  updateSessionTip,
  applyCouponToBill,
  removeCouponFromBill,
  customerPayAtCounter,
  createRazorpayOrder,
  verifyRazorpayPayment,
  downloadSessionInvoicePdf,
  submitCustomerFeedback,
} from '../controllers/billing.controller.js';
import {
  sendCustomerOtpStub,
  verifyCustomerOtpAndLink,
  redeemLoyaltyPoints,
} from '../controllers/analytics.controller.js';
import { publicMenuLimiter } from '../middleware/rateLimiter.js';
import { requireCustomerSession } from '../middleware/sessionAuth.js';
import { validate } from '../middleware/validate.js';
import {
  startSessionSchema,
  addCartItemSchema,
  updateCartItemSchema,
  deleteCartItemSchema,
  placeCustomerOrderSchema,
  createWaiterCallSchema,
  idParamSchema,
} from '../utils/validators.js';

const router = Router();

router.get('/menu/:branchSlug/:qrToken', publicMenuLimiter, getPublicMenuByQr);
router.post('/session/start', publicMenuLimiter, validate(startSessionSchema), startTableSession);

router.patch('/session/guest', requireCustomerSession, renameSessionGuest);
router.get('/session/cart', requireCustomerSession, getSessionCart);
router.post('/session/cart', requireCustomerSession, validate(addCartItemSchema), addToSessionCart);
router.patch(
  '/session/cart/:cartItemId',
  requireCustomerSession,
  validate(updateCartItemSchema),
  updateSessionCartItem
);
router.delete(
  '/session/cart/:cartItemId',
  requireCustomerSession,
  validate(deleteCartItemSchema),
  removeSessionCartItem
);

router.post('/orders', requireCustomerSession, validate(placeCustomerOrderSchema), placeCustomerOrder);
router.get('/orders', requireCustomerSession, listCustomerOrders);
router.get('/orders/:id', requireCustomerSession, validate(idParamSchema), getCustomerOrderTracker);

router.post('/calls', requireCustomerSession, validate(createWaiterCallSchema), createCustomerWaiterCall);

router.get('/bill', requireCustomerSession, getSessionBill);
router.patch('/bill/tip', requireCustomerSession, updateSessionTip);
router.post('/bill/apply-coupon', requireCustomerSession, applyCouponToBill);
router.delete('/bill/remove-coupon', requireCustomerSession, removeCouponFromBill);
router.post('/payments/pay-at-counter', requireCustomerSession, customerPayAtCounter);
router.post('/payments/razorpay/create-order', requireCustomerSession, createRazorpayOrder);
router.post('/payments/razorpay/verify', requireCustomerSession, verifyRazorpayPayment);
router.get('/sessions/:id/invoice.pdf', downloadSessionInvoicePdf);
router.post('/feedback', requireCustomerSession, submitCustomerFeedback);

// Customer Loyalty OTP & Redeem
router.post('/loyalty/send-otp', requireCustomerSession, sendCustomerOtpStub);
router.post('/loyalty/verify-otp', requireCustomerSession, verifyCustomerOtpAndLink);
router.post('/loyalty/redeem', requireCustomerSession, redeemLoyaltyPoints);

export default router;
