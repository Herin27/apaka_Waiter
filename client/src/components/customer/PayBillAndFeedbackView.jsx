import { useCallback, useEffect, useState } from 'react';
import {
  Receipt,
  Tag,
  CreditCard,
  Banknote,
  CheckCircle2,
  Download,
  Star,
  ArrowLeft,
  Users,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Button, Card, Badge, Input, Skeleton } from '../ui';
import { formatCurrency } from '../../utils/formatters';
import { cn } from '../../utils/cn';

const TIP_PRESETS = [0, 30, 50, 100];

export default function PayBillAndFeedbackView({
  sessionId,
  guestName = 'Guest 1',
  onBackToTracker,
}) {
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Split mode: 'FULL' | 'EQUAL' | 'BY_GUEST'
  const [splitMode, setSplitMode] = useState('FULL');
  const [splitCount, setSplitCount] = useState(2);

  // Payment & Post-payment Feedback states
  const [paying, setPaying] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedback, setFeedback] = useState({
    rating: 5,
    foodRating: 5,
    serviceRating: 5,
    comment: '',
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const loadBill = useCallback(async () => {
    try {
      const res = await api.get('/public/bill');
      setBill(res.data.data.bill);
      if (res.data.data.bill?.isFullyPaid) {
        setPaymentDone(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load bill');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  const handleSelectTip = async (tipAmount) => {
    try {
      const res = await api.patch('/public/bill/tip', { tipAmount });
      setBill(res.data.data.bill);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update tip');
    }
  };

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await api.post('/public/bill/apply-coupon', { code: couponCode.trim() });
      setBill(res.data.data.bill);
      toast.success(res.data.data.message);
      setCouponCode('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      const res = await api.delete('/public/bill/remove-coupon');
      setBill(res.data.data.bill);
      toast.success('Coupon removed');
    } catch {
      // Ignore
    }
  };

  const getPayableNow = () => {
    if (!bill) return 0;
    if (splitMode === 'EQUAL') {
      return Math.ceil((bill.balanceDue / Math.max(2, splitCount)) * 100) / 100;
    }
    if (splitMode === 'BY_GUEST') {
      const myShare = bill.guestSplits?.find((g) => g.guest === guestName);
      return myShare ? Math.min(bill.balanceDue, myShare.estimatedShare) : bill.balanceDue;
    }
    return bill.balanceDue;
  };

  const handleRazorpayPay = async () => {
    if (!bill || paying) return;
    const amountToPay = getPayableNow();
    if (amountToPay <= 0) return;

    setPaying(true);
    try {
      const orderRes = await api.post('/public/payments/razorpay/create-order', {
        amount: amountToPay,
        tipAmount: bill.tip,
      });
      const rzpData = orderRes.data.data;

      // Simulated Razorpay test flow if live test keys aren't set in server .env
      if (rzpData.simulated || !window.Razorpay) {
        const verifyRes = await api.post('/public/payments/razorpay/verify', {
          razorpay_order_id: rzpData.razorpayOrderId,
          razorpay_payment_id: `pay_test_${Date.now()}`,
          razorpay_signature: 'test_signature',
          amount: amountToPay,
          simulated: true,
          splitMeta: { mode: splitMode, label: guestName },
        });
        setBill(verifyRes.data.data.bill);
        setPaymentDone(true);
        toast.success('Razorpay Test Payment Successful!');
        setPaying(false);
        return;
      }

      const options = {
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: bill.restaurant.name,
        description: `Table ${bill.table.name} Bill Settlement`,
        order_id: rzpData.razorpayOrderId,
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/public/payments/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amountToPay,
              splitMeta: { mode: splitMode, label: guestName },
            });
            setBill(verifyRes.data.data.bill);
            setPaymentDone(true);
            toast.success('Payment verified & settled!');
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed');
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
        theme: { color: '#E8591A' },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initialize Razorpay checkout');
      setPaying(false);
    }
  };

  const handlePayAtCounter = async () => {
    setPaying(true);
    try {
      const res = await api.post('/public/payments/pay-at-counter', {
        tipAmount: bill?.tip || 0,
        method: 'COUNTER',
      });
      setBill(res.data.data.bill);
      toast.success('Cashier notified! You can pay Cash or UPI at the counter.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to notify counter');
    } finally {
      setPaying(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      await api.post('/public/feedback', feedback);
      setFeedbackSubmitted(true);
      toast.success('Thank you for rating your experience!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (!bill || bill.items.length === 0) {
    return (
      <Card className="p-6 text-center space-y-4">
        <p className="text-sm text-zinc-400">No billable orders in this session yet.</p>
        <Button onClick={onBackToTracker}>Back to Orders</Button>
      </Card>
    );
  }

  const currency = bill.restaurant?.currency || 'INR';
  const invoiceDownloadUrl = `${
    import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
  }/public/sessions/${bill.sessionId}/invoice.pdf`;

  // POST-PAYMENT SUCCESS + INVOICE DOWNLOAD + FEEDBACK SCREEN
  if (paymentDone || bill.isFullyPaid) {
    return (
      <div className="space-y-5 pb-12">
        <Card glow className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <div>
            <Badge tone="green">Payment Complete</Badge>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Thank You for Dining!</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Total Paid: <span className="font-bold text-white">{formatCurrency(bill.paidAmount || bill.grandTotal, currency)}</span>
              {bill.invoiceNo ? ` • Invoice ${bill.invoiceNo}` : ''}
            </p>
          </div>

          <a
            href={invoiceDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-accent/50 px-5 py-3 text-sm font-bold text-accent transition"
          >
            <Download className="h-4 w-4" />
            Download GST Invoice PDF
          </a>
        </Card>

        {feedbackSubmitted ? (
          <Card className="p-6 text-center space-y-2">
            <Sparkles className="h-7 w-7 text-accent mx-auto" />
            <h3 className="text-base font-bold text-white">Feedback Recorded</h3>
            <p className="text-xs text-zinc-400">
              We appreciate your review. Hope to see you again soon!
            </p>
          </Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-white">Rate Your Experience</h3>
              <p className="text-xs text-zinc-400">Your feedback helps us serve you better</p>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              {[
                { key: 'rating', label: 'Overall Experience' },
                { key: 'foodRating', label: 'Food Taste & Quality' },
                { key: 'serviceRating', label: 'Hospitality & Speed' },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">{row.label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedback((p) => ({ ...p, [row.key]: star }))}
                        className="p-1 cursor-pointer"
                      >
                        <Star
                          className={cn(
                            'h-5 w-5 transition',
                            star <= feedback[row.key]
                              ? 'fill-accent text-accent'
                              : 'text-zinc-600'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <textarea
                rows={2}
                value={feedback.comment}
                onChange={(e) => setFeedback((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Any suggestions or compliments for our chef & team?"
                className="w-full rounded-xl bg-surface-2 border border-border-subtle p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submittingFeedback}
                className="w-full"
              >
                Submit Feedback
              </Button>
            </form>
          </Card>
        )}
      </div>
    );
  }

  const payableNow = getPayableNow();

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToTracker}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </button>
        <Badge tone="orange">Table {bill.table.name}</Badge>
      </div>

      {/* Itemized Bill Summary */}
      <Card glow className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-accent" />
            <h2 className="text-base font-extrabold text-white">Table Bill Summary</h2>
          </div>
          <span className="text-xs text-zinc-400">{bill.ordersCount} order(s)</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {bill.items.map((item, idx) => (
            <div key={`${item.itemId}_${idx}`} className="flex justify-between text-xs">
              <span className="text-zinc-300">
                {item.qty}× {item.name}
                {item.variant ? ` (${item.variant})` : ''}
              </span>
              <span className="font-bold text-white">
                {formatCurrency(item.lineTotal, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* Coupon Input */}
        {bill.coupon ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/35 px-3 py-2 text-xs">
            <span className="font-bold text-emerald-300">
              Coupon {bill.coupon.code} applied (-{formatCurrency(bill.discount, currency)})
            </span>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-red-300 hover:underline font-semibold cursor-pointer"
            >
              Remove
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyCoupon} className="flex items-center gap-2">
            <Input
              placeholder="Promo code (e.g. WELCOME10)"
              icon={Tag}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <Button type="submit" variant="secondary" loading={applyingCoupon}>
              Apply
            </Button>
          </form>
        )}

        {/* Tip Selector */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-bold text-zinc-400">Add a Tip for Staff</span>
          <div className="grid grid-cols-4 gap-2">
            {TIP_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleSelectTip(amt)}
                className={cn(
                  'rounded-xl border py-2 text-xs font-bold transition cursor-pointer',
                  bill.tip === amt
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-surface-2 border-border-subtle text-zinc-300 hover:text-white'
                )}
              >
                {amt === 0 ? 'No Tip' : formatCurrency(amt, currency)}
              </button>
            ))}
          </div>
        </div>

        {/* Tax & Total Breakdown */}
        <div className="space-y-1.5 border-t border-border-subtle pt-3 text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span>{formatCurrency(bill.subtotal, currency)}</span>
          </div>
          {bill.discount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Discount</span>
              <span>-{formatCurrency(bill.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-zinc-400">
            <span>CGST ({bill.cgstPercent}%)</span>
            <span>{formatCurrency(bill.cgst, currency)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>SGST ({bill.sgstPercent}%)</span>
            <span>{formatCurrency(bill.sgst, currency)}</span>
          </div>
          {bill.serviceCharge > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Service Charge ({bill.serviceChargePercent}%)</span>
              <span>{formatCurrency(bill.serviceCharge, currency)}</span>
            </div>
          )}
          {bill.tip > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Staff Tip</span>
              <span>{formatCurrency(bill.tip, currency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border-subtle text-base font-extrabold text-white">
            <span>Grand Total</span>
            <span className="text-accent">{formatCurrency(bill.grandTotal, currency)}</span>
          </div>
          {bill.paidAmount > 0 && (
            <div className="flex justify-between text-emerald-400 font-semibold">
              <span>Already Paid</span>
              <span>-{formatCurrency(bill.paidAmount, currency)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Split Options */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
          <Users className="h-3.5 w-3.5 text-accent" />
          Split Bill Options
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'FULL', label: 'Full Bill' },
            { value: 'EQUAL', label: 'Split Equally' },
            { value: 'BY_GUEST', label: 'My Items' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSplitMode(opt.value)}
              className={cn(
                'rounded-xl border py-2 text-xs font-bold transition cursor-pointer',
                splitMode === opt.value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface-2 text-zinc-300 border-border-subtle'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {splitMode === 'EQUAL' && (
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs">
            <span className="text-zinc-300">Split between guests:</span>
            <div className="flex items-center gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSplitCount(n)}
                  className={cn(
                    'h-7 w-7 rounded-lg font-bold cursor-pointer',
                    splitCount === n ? 'bg-accent text-white' : 'bg-surface-1 text-zinc-400'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Payment Actions */}
      <div className="space-y-2.5">
        <Button
          variant="primary"
          size="lg"
          loading={paying}
          onClick={handleRazorpayPay}
          className="w-full justify-between px-5"
        >
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pay Online (Razorpay / UPI / Card)
          </span>
          <span className="font-extrabold">{formatCurrency(payableNow, currency)}</span>
        </Button>

        <Button
          variant="secondary"
          size="lg"
          disabled={paying}
          onClick={handlePayAtCounter}
          className="w-full"
        >
          <Banknote className="h-4 w-4 text-emerald-400" />
          Pay Cash / UPI at Counter
        </Button>
      </div>
    </div>
  );
}
