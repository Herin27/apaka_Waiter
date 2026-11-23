import { useMemo, useState } from 'react';
import { Search, Plus, Minus, ShoppingBag, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Button, Badge } from '../ui';
import { formatCurrency } from '../../utils/formatters';
import api from '../../api/axios';

export default function WaiterOrderModal({
  open,
  onClose,
  table,
  categories = [],
  menuItems = [],
  onOrderCreated,
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [basket, setBasket] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.isAvailable) return false;
      if (selectedCategory !== 'ALL') {
        const catId = item.categoryId?._id || item.categoryId;
        if (String(catId) !== String(selectedCategory)) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (item.name?.en || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, selectedCategory, search]);

  if (!table) return null;

  const addToBasket = (item) => {
    setBasket((prev) => {
      const idx = prev.findIndex((b) => b.menuItem._id === item._id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { menuItem: item, qty: 1, note: '' }];
    });
  };

  const updateBasketQty = (menuItemId, qty) => {
    setBasket((prev) =>
      qty <= 0
        ? prev.filter((b) => b.menuItem._id !== menuItemId)
        : prev.map((b) => (b.menuItem._id === menuItemId ? { ...b, qty } : b))
    );
  };

  const updateBasketNote = (menuItemId, note) => {
    setBasket((prev) =>
      prev.map((b) => (b.menuItem._id === menuItemId ? { ...b, note } : b))
    );
  };

  const subtotal = basket.reduce((sum, b) => sum + b.menuItem.price * b.qty, 0);

  const handleSubmitOrder = async () => {
    if (basket.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        tableId: table._id,
        idempotencyKey: `waiter_${table._id}_${Date.now()}`,
        items: basket.map((b) => ({
          menuItemId: b.menuItem._id,
          qty: b.qty,
          note: b.note.trim(),
        })),
      };

      const res = await api.post('/orders', payload);
      toast.success(`Order ${res.data.data.order.orderNo} placed for Table ${table.name}`);
      onOrderCreated?.(res.data.data.order);
      setBasket([]);
      setSearch('');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Place Order — Table ${table.name}`}
      description="Order placed directly by waiter goes straight to CONFIRMED status."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Quick search menu items..."
              className="w-full h-10 rounded-xl bg-surface-2 border border-border-subtle pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => setSelectedCategory(c._id)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  String(selectedCategory) === String(c._id)
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-zinc-400 hover:text-white'
                }`}
              >
                {c.name?.en}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const inBasket = basket.find((b) => b.menuItem._id === item._id);
            return (
              <div
                key={item._id}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 border border-border-subtle p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <p className="text-xs font-bold text-white truncate">{item.name?.en}</p>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-400 mt-0.5">
                    {formatCurrency(item.price)}
                  </p>
                </div>

                {inBasket ? (
                  <div className="flex items-center rounded-lg bg-surface-1 border border-accent/40 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateBasketQty(item._id, inBasket.qty - 1)}
                      className="h-6 w-6 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-extrabold text-accent">
                      {inBasket.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateBasketQty(item._id, inBasket.qty + 1)}
                      className="h-6 w-6 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => addToBasket(item)}>
                    <Plus className="h-3.5 w-3.5 text-accent" />
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {basket.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-surface-2/80 border border-border-strong p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                <ShoppingBag className="h-3.5 w-3.5 text-accent" />
                Selected Items ({basket.reduce((s, i) => s + i.qty, 0)})
              </span>
              <Badge tone="orange">Subtotal: {formatCurrency(subtotal)}</Badge>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {basket.map((entry) => (
                <div key={entry.menuItem._id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-200">
                      {entry.qty}× {entry.menuItem.name?.en}
                    </span>
                    <span className="font-bold text-white">
                      {formatCurrency(entry.menuItem.price * entry.qty)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={entry.note}
                    onChange={(e) => updateBasketNote(entry.menuItem._id, e.target.value)}
                    placeholder="Kitchen note (optional)..."
                    className="w-full h-7 rounded-lg bg-surface-1 border border-border-subtle px-2.5 text-[11px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={basket.length === 0}
            onClick={handleSubmitOrder}
          >
            <Send className="h-4 w-4" />
            Send Order ({formatCurrency(subtotal)})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
