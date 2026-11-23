import { useMemo } from 'react';
import { Minus, Plus, Trash2, Users, ShoppingBag, ArrowRight } from 'lucide-react';
import { Drawer, Button, EmptyState } from '../ui';
import { formatCurrency } from '../../utils/formatters';

export default function CartDrawer({
  open,
  onClose,
  cart = [],
  subtotal = 0,
  taxPercent = 5,
  serviceChargePercent = 0,
  currency = 'INR',
  onUpdateQty,
  onRemoveItem,
  onPlaceOrder,
  placingOrder = false,
}) {
  const totals = useMemo(() => {
    const sub = Number(subtotal || 0);
    const tax = Math.round(((sub * taxPercent) / 100 + Number.EPSILON) * 100) / 100;
    const serviceCharge =
      Math.round(((sub * serviceChargePercent) / 100 + Number.EPSILON) * 100) / 100;
    const total = Math.round((sub + tax + serviceCharge + Number.EPSILON) * 100) / 100;
    return { sub, tax, serviceCharge, total };
  }, [subtotal, taxPercent, serviceChargePercent]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Shared Table Cart (${cart.reduce((s, i) => s + i.qty, 0)} items)`}
      footer={
        cart.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Item Subtotal</span>
                <span>{formatCurrency(totals.sub, currency)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>GST / Tax ({taxPercent}%)</span>
                <span>{formatCurrency(totals.tax, currency)}</span>
              </div>
              {serviceChargePercent > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Service Charge ({serviceChargePercent}%)</span>
                  <span>{formatCurrency(totals.serviceCharge, currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-border-subtle text-sm font-extrabold text-white">
                <span>Grand Total</span>
                <span className="text-accent">{formatCurrency(totals.total, currency)}</span>
              </div>
            </div>

            <Button
              size="lg"
              loading={placingOrder}
              disabled={placingOrder}
              onClick={onPlaceOrder}
              className="w-full justify-between px-5"
            >
              <span>Place Order to Kitchen</span>
              <span className="inline-flex items-center gap-1.5 font-extrabold">
                {formatCurrency(totals.total, currency)}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </div>
        )
      }
    >
      {cart.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your table cart is empty"
          description="Items added by you or anyone at your table will appear here in real time."
          action={
            <Button variant="secondary" onClick={onClose}>
              Browse Menu
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/25 px-3 py-2 text-xs text-zinc-300">
            <Users className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>Live shared cart — everyone at this table can add or edit items.</span>
          </div>

          {cart.map((item) => (
            <div
              key={item._id}
              className="rounded-2xl bg-surface-2 border border-border-subtle p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white">{item.name}</h4>
                  {item.variant?.name && (
                    <p className="text-xs text-zinc-400">Variant: {item.variant.name}</p>
                  )}
                  {item.addons?.length > 0 && (
                    <p className="text-xs text-zinc-400">
                      Add-ons: {item.addons.map((a) => a.name).join(', ')}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-xs text-amber-300/90 mt-0.5">Note: “{item.note}”</p>
                  )}
                  <span className="mt-1 inline-block rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    Added by {item.addedByGuest || 'Guest 1'}
                  </span>
                </div>

                <span className="text-sm font-extrabold text-white shrink-0">
                  {formatCurrency(item.price * item.qty, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => onRemoveItem(item._id)}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>

                <div className="flex items-center rounded-xl bg-surface-1 border border-border-strong p-0.5">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item._id, item.qty - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-xs font-extrabold text-white">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item._id, item.qty + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
