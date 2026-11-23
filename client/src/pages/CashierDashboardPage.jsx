import { useCallback, useEffect, useState } from 'react';
import {
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  Download,
  Tag,
  Plus,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  Users,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useSocket } from '../api/socket';
import { useAuthStore } from '../store/useAuthStore';
import {
  Button,
  Card,
  Badge,
  StatusPill,
  Input,
  Select,
  Modal,
  EmptyState,
  Skeleton,
} from '../components/ui';
import { formatCurrency } from '../utils/formatters';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export default function CashierDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'payments' | 'zreport'
  const [loading, setLoading] = useState(true);
  const [openTables, setOpenTables] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeBill, setActiveBill] = useState(null);

  // Coupon & Tip inputs
  const [couponInput, setCouponInput] = useState('');
  const [tipInput, setTipInput] = useState('0');

  // Split Bill UI state: 'FULL' | 'EQUAL' | 'BY_ITEM' | 'BY_GUEST'
  const [splitMode, setSplitMode] = useState('FULL');
  const [equalWays, setEqualWays] = useState(2);
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  // Mixed Payment Rows: [{ method: 'CASH'|'UPI'|'CARD', amount: '', transactionRef: '' }]
  const [paymentRows, setPaymentRows] = useState([
    { method: 'UPI', amount: '', transactionRef: '' },
  ]);
  const [settling, setSettling] = useState(false);

  // Recent Payments & Refund Modal
  const [recentPayments, setRecentPayments] = useState([]);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Z-Report state
  const [zDate, setZDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [zReport, setZReport] = useState(null);

  const fetchOpenTables = useCallback(async () => {
    try {
      const res = await api.get('/payments/open-tables');
      const list = res.data.data.openTables || [];
      setOpenTables(list);

      if (list.length > 0) {
        const current = list.find((t) => String(t.sessionId) === String(selectedSessionId)) || list[0];
        setSelectedSessionId(current.sessionId);
        setActiveBill(current.bill);
        setTipInput(String(current.bill?.tip || 0));
        setPaymentRows([
          { method: 'UPI', amount: String(current.bill?.balanceDue || 0), transactionRef: '' },
        ]);
      } else {
        setSelectedSessionId(null);
        setActiveBill(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load open tables');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  const fetchRecentPayments = useCallback(async () => {
    try {
      const res = await api.get('/payments');
      setRecentPayments(res.data.data.payments || []);
    } catch {
      // Ignore
    }
  }, []);

  const fetchZReport = useCallback(async (dateVal) => {
    try {
      const res = await api.get(`/reports/z-report?date=${dateVal}`);
      setZReport(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load Z-Report');
    }
  }, []);

  useEffect(() => {
    fetchOpenTables();
    fetchRecentPayments();
  }, [fetchOpenTables, fetchRecentPayments]);

  useEffect(() => {
    if (activeTab === 'zreport') {
      fetchZReport(zDate);
    }
  }, [activeTab, zDate, fetchZReport]);

  // Live Socket Updates
  useSocket('order:new', () => fetchOpenTables());
  useSocket('order:updated', () => fetchOpenTables());
  useSocket('table:updated', () => fetchOpenTables());
  useSocket('bill:paid', () => {
    fetchOpenTables();
    fetchRecentPayments();
  });

  const handleSelectTable = async (entry) => {
    setSelectedSessionId(entry.sessionId);
    setActiveBill(entry.bill);
    setTipInput(String(entry.bill?.tip || 0));
    setSelectedItemIds([]);
    setSplitMode('FULL');
    setPaymentRows([
      { method: 'UPI', amount: String(entry.bill?.balanceDue || 0), transactionRef: '' },
    ]);
  };

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!selectedSessionId || !couponInput.trim()) return;
    try {
      const res = await api.post('/bill/apply-coupon', {
        sessionId: selectedSessionId,
        code: couponInput.trim(),
      });
      const updated = res.data.data.bill;
      setActiveBill(updated);
      setPaymentRows([{ method: 'UPI', amount: String(updated.balanceDue), transactionRef: '' }]);
      setCouponInput('');
      toast.success(res.data.data.message);
      fetchOpenTables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Coupon could not be applied');
    }
  };

  const handleUpdateTip = async () => {
    if (!selectedSessionId) return;
    try {
      const res = await api.patch(`/sessions/${selectedSessionId}/tip`, {
        tipAmount: Number(tipInput || 0),
      });
      const updated = res.data.data.bill;
      setActiveBill(updated);
      setPaymentRows([{ method: 'UPI', amount: String(updated.balanceDue), transactionRef: '' }]);
      toast.success('Tip updated');
      fetchOpenTables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update tip');
    }
  };

  const applySplitAmountToPaymentRow = (amount) => {
    setPaymentRows([{ method: 'UPI', amount: String(Math.round(amount)), transactionRef: '' }]);
  };

  const handleAddMixedRow = () => {
    const allocated = paymentRows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const remaining = Math.max(0, (activeBill?.balanceDue || 0) - allocated);
    setPaymentRows((prev) => [
      ...prev,
      { method: 'CASH', amount: String(remaining), transactionRef: '' },
    ]);
  };

  const handleRecordPayment = async () => {
    if (!selectedSessionId || settling) return;
    const validRows = paymentRows.filter((r) => Number(r.amount) > 0);
    if (!validRows.length) {
      toast.error('Enter a valid payment amount');
      return;
    }

    setSettling(true);
    try {
      const res = await api.post('/payments/record', {
        sessionId: selectedSessionId,
        payments: validRows.map((r) => ({
          method: r.method,
          amount: Number(r.amount),
          transactionRef: r.transactionRef,
        })),
        splitMeta: { mode: splitMode },
      });

      const { settled, bill } = res.data.data;
      toast.success(
        settled
          ? `Bill fully settled! Invoice ${bill.invoiceNo} generated.`
          : `Partial payment recorded. Remaining due: ₹${bill.balanceDue}`
      );
      await fetchOpenTables();
      await fetchRecentPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSettling(false);
    }
  };

  const handleConfirmRefund = async (e) => {
    e.preventDefault();
    if (!refundTarget || refundReason.trim().length < 2) return;
    setRefunding(true);
    try {
      await api.post(`/payments/${refundTarget._id}/refund`, {
        reason: refundReason.trim(),
        action: 'REFUNDED',
      });
      toast.success('Payment refunded & logged');
      setRefundTarget(null);
      setRefundReason('');
      fetchRecentPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed (Admin approval required)');
    } finally {
      setRefunding(false);
    }
  };

  const downloadInvoicePdf = async (sessionId, invoiceNo) => {
    try {
      const res = await api.get(`/sessions/${sessionId}/invoice.pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNo || 'invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Failed to download PDF invoice');
    }
  };

  const openThermalReceipt = async (sessionId, width = 80) => {
    try {
      const res = await api.get(`/sessions/${sessionId}/thermal-bill?width=${width}`);
      const win = window.open('', '_blank', 'width=380,height=650');
      if (win) {
        win.document.write(res.data);
        win.document.close();
      }
    } catch {
      toast.error('Failed to open thermal receipt');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Cashier POS Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/35 text-accent">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Cashier POS &amp; Billing</h1>
            <p className="text-xs text-zinc-400">
              {openTables.length} active table tabs • GSTIN Ready
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-surface-2 p-1 border border-border-subtle">
          {[
            { id: 'pos', label: 'Active Bills' },
            { id: 'payments', label: 'Payments & Refunds' },
            { id: 'zreport', label: 'Z-Report (EOD)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer',
                activeTab === tab.id
                  ? 'bg-accent text-white shadow-orange-glow'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: ACTIVE TABLES & BILLING POS */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Open Tables List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Open Table Sessions ({openTables.length})
            </h2>

            {openTables.length === 0 ? (
              <EmptyState
                title="No open bills"
                description="Active dining sessions with orders will appear here."
              />
            ) : (
              openTables.map((entry) => {
                const isSelected = String(entry.sessionId) === String(selectedSessionId);
                return (
                  <Card
                    key={entry.sessionId}
                    glow={isSelected}
                    onClick={() => handleSelectTable(entry)}
                    className={cn(
                      'p-4 cursor-pointer transition',
                      isSelected ? 'border-accent bg-accent/10' : 'hover:border-border-strong'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-xl bg-accent px-3 py-1 text-sm font-black text-white">
                          {entry.table?.name}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {entry.bill.ordersCount} Order(s)
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {entry.guestsCount} Guest(s)
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-base font-extrabold text-white">
                          {formatCurrency(entry.bill.balanceDue)}
                        </p>
                        <StatusPill status={entry.table?.status || 'SEATED'} />
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Right: Detailed Bill, Split, Coupon & Mixed Payment Collector */}
          <div className="lg:col-span-8">
            {!activeBill ? (
              <EmptyState
                title="Select a table to settle"
                description="Choose an open table on the left to view itemized GST bill, split options, or record payment."
              />
            ) : (
              <Card glow className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-extrabold text-white">
                        Table {activeBill.table.name} Bill
                      </h2>
                      <Badge tone="orange">Due: {formatCurrency(activeBill.balanceDue)}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      GSTIN: {activeBill.restaurant.gstin || 'N/A'} • CGST{' '}
                      {activeBill.cgstPercent}% + SGST {activeBill.sgstPercent}%
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openThermalReceipt(activeBill.sessionId, 80)}
                    >
                      <Printer className="h-3.5 w-3.5 text-accent" />
                      80mm Thermal
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        downloadInvoicePdf(activeBill.sessionId, activeBill.invoiceNo)
                      }
                    >
                      <Download className="h-3.5 w-3.5 text-accent" />
                      PDF Invoice
                    </Button>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {activeBill.items.map((item, idx) => (
                    <div
                      key={`${item.itemId}_${idx}`}
                      className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">
                          {item.qty}× {item.name}
                        </span>
                        {item.variant && (
                          <span className="text-zinc-400"> ({item.variant})</span>
                        )}
                        <span className="ml-2 text-[10px] text-zinc-500">
                          [{item.addedByGuest}]
                        </span>
                      </div>
                      <span className="font-bold text-white">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon + Tip Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                  <form onSubmit={handleApplyCoupon} className="flex items-center gap-2">
                    <Input
                      placeholder="Coupon code (WELCOME10)"
                      icon={Tag}
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    />
                    <Button type="submit" variant="secondary">
                      Apply
                    </Button>
                  </form>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Tip (₹)"
                      value={tipInput}
                      onChange={(e) => setTipInput(e.target.value)}
                    />
                    <Button variant="secondary" onClick={handleUpdateTip}>
                      Set Tip
                    </Button>
                  </div>
                </div>

                {/* Tax & Totals Summary */}
                <div className="rounded-2xl bg-surface-2 p-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(activeBill.subtotal)}</span>
                  </div>
                  {activeBill.discount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Discount ({activeBill.coupon?.code})</span>
                      <span>-{formatCurrency(activeBill.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-400">
                    <span>
                      CGST ({activeBill.cgstPercent}%) + SGST ({activeBill.sgstPercent}%)
                    </span>
                    <span>
                      {formatCurrency(activeBill.cgst)} + {formatCurrency(activeBill.sgst)}
                    </span>
                  </div>
                  {activeBill.serviceCharge > 0 && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Service Charge ({activeBill.serviceChargePercent}%)</span>
                      <span>{formatCurrency(activeBill.serviceCharge)}</span>
                    </div>
                  )}
                  {activeBill.tip > 0 && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Tip</span>
                      <span>{formatCurrency(activeBill.tip)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border-subtle text-base font-extrabold text-white">
                    <span>Grand Total</span>
                    <span className="text-accent">
                      {formatCurrency(activeBill.grandTotal)}
                    </span>
                  </div>
                  {activeBill.paidAmount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Paid So Far</span>
                      <span>{formatCurrency(activeBill.paidAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Split Bill Calculator */}
                <div className="rounded-2xl bg-surface-2/60 border border-border-subtle p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
                      <Users className="h-3.5 w-3.5 text-accent" />
                      Split Bill Helper
                    </span>

                    <div className="flex gap-1.5">
                      {[
                        { id: 'FULL', label: 'Full' },
                        { id: 'EQUAL', label: 'Equal Split' },
                        { id: 'BY_GUEST', label: 'By Guest' },
                        { id: 'BY_ITEM', label: 'By Item' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSplitMode(m.id);
                            if (m.id === 'FULL') {
                              applySplitAmountToPaymentRow(activeBill.balanceDue);
                            }
                          }}
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer',
                            splitMode === m.id
                              ? 'bg-accent text-white'
                              : 'bg-surface-1 text-zinc-400 hover:text-white'
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {splitMode === 'EQUAL' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">Number of splits:</span>
                      <div className="flex items-center gap-2">
                        {[2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setEqualWays(n);
                              applySplitAmountToPaymentRow(activeBill.balanceDue / n);
                            }}
                            className={cn(
                              'h-7 w-7 rounded-lg font-bold cursor-pointer',
                              equalWays === n
                                ? 'bg-accent text-white'
                                : 'bg-surface-1 text-zinc-400'
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {splitMode === 'BY_GUEST' && (
                    <div className="flex flex-wrap gap-2">
                      {activeBill.guestSplits?.map((g) => (
                        <button
                          key={g.guest}
                          type="button"
                          onClick={() => applySplitAmountToPaymentRow(g.estimatedShare)}
                          className="rounded-xl bg-surface-1 hover:border-accent border border-border-subtle px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                        >
                          {g.guest}: {formatCurrency(g.estimatedShare)}
                        </button>
                      ))}
                    </div>
                  )}

                  {splitMode === 'BY_ITEM' && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-zinc-400">
                        Select items for this partial payment:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeBill.items.map((it) => {
                          const checked = selectedItemIds.includes(it.itemId);
                          return (
                            <button
                              key={it.itemId}
                              type="button"
                              onClick={() => {
                                const next = checked
                                  ? selectedItemIds.filter((id) => id !== it.itemId)
                                  : [...selectedItemIds, it.itemId];
                                setSelectedItemIds(next);
                                const sum = activeBill.items
                                  .filter((x) => next.includes(x.itemId))
                                  .reduce((s, x) => s + x.lineTotal, 0);
                                applySplitAmountToPaymentRow(sum * 1.05);
                              }}
                              className={cn(
                                'rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer',
                                checked
                                  ? 'bg-accent/20 border-accent text-white'
                                  : 'bg-surface-1 border-border-subtle text-zinc-400'
                              )}
                            >
                              {it.qty}× {it.name} ({formatCurrency(it.lineTotal)})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mixed / Partial Payment Collector */}
                <div className="space-y-3 border-t border-border-subtle pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Collect Payment (Supports Mixed Cash + UPI/Card)
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddMixedRow}
                      className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Mixed Mode
                    </button>
                  </div>

                  {paymentRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <Select
                          value={row.method}
                          onChange={(e) =>
                            setPaymentRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, method: e.target.value } : r
                              )
                            )
                          }
                          options={[
                            { value: 'UPI', label: 'UPI / QR' },
                            { value: 'CASH', label: 'Cash' },
                            { value: 'CARD', label: 'Card POS' },
                          ]}
                        />
                      </div>

                      <div className="col-span-4">
                        <Input
                          type="number"
                          min={1}
                          step="0.01"
                          placeholder="Amount (₹)"
                          value={row.amount}
                          onChange={(e) =>
                            setPaymentRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, amount: e.target.value } : r
                              )
                            )
                          }
                        />
                      </div>

                      <div className="col-span-3">
                        <Input
                          placeholder="Ref # (opt)"
                          value={row.transactionRef}
                          onChange={(e) =>
                            setPaymentRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, transactionRef: e.target.value } : r
                              )
                            )
                          }
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        {paymentRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentRows((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="primary"
                    size="lg"
                    loading={settling}
                    onClick={handleRecordPayment}
                    className="w-full font-extrabold"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Mark Paid &amp; Settle (
                    {formatCurrency(
                      paymentRows.reduce((s, r) => s + Number(r.amount || 0), 0)
                    )}
                    )
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RECENT PAYMENTS & REFUNDS */}
      {activeTab === 'payments' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-white">Recent Transactions</h2>
            <Button variant="secondary" size="sm" onClick={fetchRecentPayments}>
              Refresh
            </Button>
          </div>

          {recentPayments.length === 0 ? (
            <EmptyState title="No payments recorded yet" />
          ) : (
            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div
                  key={p._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 border border-border-subtle p-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">
                        {formatCurrency(p.amount)}
                      </span>
                      <Badge tone="orange">{p.method}</Badge>
                      <Badge tone={p.status === 'COMPLETED' ? 'green' : 'red'}>
                        {p.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Table {p.tableId?.name || 'N/A'} •{' '}
                      {new Date(p.paidAt).toLocaleString('en-IN')}
                      {p.transactionRef ? ` • Ref: ${p.transactionRef}` : ''}
                    </p>
                    {p.refundReason && (
                      <p className="text-xs text-red-300">Refund Reason: {p.refundReason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => downloadInvoicePdf(p.sessionId, '')}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Invoice
                    </Button>

                    {isAdmin && p.status === 'COMPLETED' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRefundTarget(p)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refund
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: Z-REPORT (END-OF-DAY SUMMARY) */}
      {activeTab === 'zreport' && (
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-base font-extrabold text-white">
                  End-of-Day Z-Report Summary
                </h2>
                <p className="text-xs text-zinc-400">
                  Daily sales, GST collected, and payment mode reconciliation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={zDate}
                onChange={(e) => setZDate(e.target.value)}
                className="h-10 rounded-xl bg-surface-2 border border-border-subtle px-3 text-xs font-bold text-white"
              />
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" />
                Print Report
              </Button>
            </div>
          </div>

          {zReport && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-surface-2 p-4 border border-border-subtle">
                  <p className="text-xs text-zinc-400">Orders Completed</p>
                  <p className="mt-1 text-2xl font-black text-white">{zReport.ordersCount}</p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-4 border border-border-subtle">
                  <p className="text-xs text-zinc-400">Gross Sales</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {formatCurrency(zReport.grossSales)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-4 border border-border-subtle">
                  <p className="text-xs text-zinc-400">Total GST Collected</p>
                  <p className="mt-1 text-2xl font-black text-sky-400">
                    {formatCurrency(zReport.taxCollected)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-4 border border-accent/40">
                  <p className="text-xs text-zinc-400">Net Revenue Collected</p>
                  <p className="mt-1 text-2xl font-black text-accent">
                    {formatCurrency(zReport.netRevenue)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-2 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Collections by Payment Mode
                </h3>
                {Object.keys(zReport.byPaymentMethod || {}).length === 0 ? (
                  <p className="text-xs text-zinc-500">No completed collections on this date.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {Object.entries(zReport.byPaymentMethod).map(([method, total]) => (
                      <div
                        key={method}
                        className="rounded-xl bg-surface-1 border border-border-subtle p-3"
                      >
                        <p className="text-[11px] font-bold text-zinc-400">{method}</p>
                        <p className="text-base font-extrabold text-white mt-0.5">
                          {formatCurrency(total)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Admin Refund Modal */}
      <Modal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title="Approve Payment Refund"
        description={`Refunding ${formatCurrency(refundTarget?.amount || 0)} (${refundTarget?.method})`}
      >
        <form onSubmit={handleConfirmRefund} className="space-y-4">
          <Input
            label="Refund Reason (Logged to Audit Trail) *"
            required
            placeholder="e.g. Overcharged item / Customer complaint"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={refunding}>
              Confirm Refund
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
