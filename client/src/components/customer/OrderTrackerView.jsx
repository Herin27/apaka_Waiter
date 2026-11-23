import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChefHat,
  BellRing,
  Utensils,
  Clock,
  XCircle,
  PlusCircle,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { Card, Button, StatusPill, Badge } from '../ui';
import { formatCurrency } from '../../utils/formatters';
import { cn } from '../../utils/cn';

const STEPS = [
  { key: 'PLACED', label: 'Received', icon: BellRing },
  { key: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'Preparing', icon: ChefHat },
  { key: 'READY', label: 'Ready', icon: Sparkles },
  { key: 'SERVED', label: 'Served', icon: Utensils },
];

const STEP_INDEX = {
  PLACED: 0,
  CONFIRMED: 1,
  PREPARING: 2,
  READY: 3,
  SERVED: 4,
  PAID: 4,
};

function EtaCountdown({ createdAt, etaMinutes = 18, status }) {
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    const targetMs = new Date(createdAt).getTime() + etaMinutes * 60 * 1000;
    const tick = () => {
      setRemainingSec(Math.max(0, Math.floor((targetMs - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [createdAt, etaMinutes]);

  if (['READY', 'SERVED', 'PAID'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 px-3 py-1 text-xs font-bold text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {status === 'READY' ? 'Ready to serve!' : 'Served at table'}
      </span>
    );
  }

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 border border-accent/40 px-3 py-1 font-mono text-xs font-bold text-accent">
      <Clock className="h-3.5 w-3.5" />
      ETA {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

export default function OrderTrackerView({
  orders = [],
  currency = 'INR',
  onAddMoreItems,
  onRequestBill,
  billCooldown = 0,
}) {
  const activeOrder = orders[0] || null;

  if (!activeOrder) {
    return (
      <Card className="p-6 text-center space-y-4">
        <p className="text-sm text-zinc-400">No orders placed in this session yet.</p>
        <Button onClick={onAddMoreItems}>Explore Menu</Button>
      </Card>
    );
  }

  const isFailed = ['REJECTED', 'CANCELLED'].includes(activeOrder.status);
  const currentStep = STEP_INDEX[activeOrder.status] ?? 0;

  const sessionGrandTotal = orders
    .filter((o) => !['REJECTED', 'CANCELLED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <div className="space-y-4 pb-24">
      <Card glow={!isFailed} className="p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Live Order Tracker
            </span>
            <h2 className="text-xl font-extrabold text-white">{activeOrder.orderNo}</h2>
          </div>

          <div className="flex items-center gap-2">
            {!isFailed && (
              <EtaCountdown
                createdAt={activeOrder.createdAt}
                etaMinutes={18}
                status={activeOrder.status}
              />
            )}
            <StatusPill status={activeOrder.status} />
          </div>
        </div>

        {isFailed ? (
          <div className="rounded-2xl bg-red-500/15 border border-red-500/40 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-300">
                Order {activeOrder.status === 'REJECTED' ? 'Rejected' : 'Cancelled'}
              </h4>
              <p className="text-xs text-red-200/80 mt-1">
                Reason: {activeOrder.rejectReason || activeOrder.cancelReason || 'Cancelled by staff'}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative pt-2 pb-1">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const completed = index <= currentStep;
                const isCurrent = index === currentStep;
                return (
                  <div key={step.key} className="flex flex-1 flex-col items-center relative">
                    {index > 0 && (
                      <div
                        className={cn(
                          'absolute top-4 -left-1/2 w-full h-0.5 -z-0 transition-colors',
                          index <= currentStep ? 'bg-accent' : 'bg-zinc-800'
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all',
                        completed
                          ? 'bg-accent border-accent text-white shadow-orange-glow'
                          : 'bg-surface-2 border-border-strong text-zinc-500',
                        isCurrent && 'scale-110'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span
                      className={cn(
                        'mt-1.5 text-[10px] font-bold text-center',
                        completed ? 'text-white' : 'text-zinc-500'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Items in {activeOrder.orderNo}
          </h4>
          {activeOrder.items?.map((item) => (
            <div
              key={item._id}
              className="flex items-center justify-between rounded-xl bg-surface-2 border border-border-subtle px-3 py-2.5"
            >
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white truncate">
                  {item.qty}× {item.name}
                </p>
                {item.variant?.name && (
                  <p className="text-[11px] text-zinc-400">{item.variant.name}</p>
                )}
              </div>
              <StatusPill status={item.status} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="primary" size="md" onClick={onAddMoreItems}>
            <PlusCircle className="h-4 w-4" />
            Add More Items
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled={billCooldown > 0}
            onClick={onRequestBill}
          >
            <Receipt className="h-4 w-4 text-accent" />
            {billCooldown > 0 ? `Bill (${billCooldown}s)` : 'Request Bill'}
          </Button>
        </div>
      </Card>

      {orders.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Session Order History</h3>
            <Badge tone="orange">Total: {formatCurrency(sessionGrandTotal, currency)}</Badge>
          </div>

          <div className="space-y-2.5">
            {orders.map((ord) => (
              <div
                key={ord._id}
                className="rounded-xl bg-surface-2 border border-border-subtle p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white">{ord.orderNo}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200">
                      {formatCurrency(ord.total, currency)}
                    </span>
                    <StatusPill status={ord.status} />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {ord.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
