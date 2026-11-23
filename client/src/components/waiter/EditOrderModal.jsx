import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Modal, Button } from '../ui';
import { formatCurrency } from '../../utils/formatters';

export default function EditOrderModal({
  order,
  open,
  onClose,
  onSaveEdits,
  onCancelWholeOrder,
}) {
  const [draftItems, setDraftItems] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setDraftItems(
        (order.items || []).map((item) => ({
          ...item,
          newQty: item.qty,
          removed: false,
        }))
      );
      setReason('');
    }
  }, [order]);

  if (!order) return null;

  const canEdit = ['PLACED', 'CONFIRMED'].includes(order.status);
  const activeItems = draftItems.filter((i) => !i.removed && i.newQty > 0);
  const hasRemovedItems = draftItems.some((i) => i.removed || i.newQty === 0);

  const updateItemQty = (itemId, nextQty) => {
    setDraftItems((prev) =>
      prev.map((item) =>
        item._id === itemId
          ? { ...item, newQty: Math.max(0, nextQty), removed: nextQty <= 0 }
          : item
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if ((hasRemovedItems || activeItems.length === 0) && reason.trim().length < 2) {
      return;
    }

    setSaving(true);
    try {
      if (activeItems.length === 0) {
        await onCancelWholeOrder(order._id, reason.trim() || 'All items removed by waiter');
      } else {
        await onSaveEdits(order, draftItems, reason.trim());
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Order ${order.orderNo}`}
      description={`Table ${order.tableId?.name || ''} • Allowed only before kitchen starts PREPARING.`}
    >
      {!canEdit ? (
        <div className="rounded-xl bg-red-500/15 border border-red-500/35 p-4 flex items-center gap-2.5 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>This order is already {order.status} and can no longer be edited.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {draftItems.map((item) => (
              <div
                key={item._id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  item.removed
                    ? 'bg-red-500/10 border-red-500/30 opacity-60'
                    : 'bg-surface-2 border-border-subtle'
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold ${
                      item.removed ? 'line-through text-zinc-400' : 'text-white'
                    }`}
                  >
                    {item.name}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {formatCurrency(item.price)} each
                    {item.variant?.name ? ` • ${item.variant.name}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center rounded-xl bg-surface-1 border border-border-strong p-0.5">
                    <button
                      type="button"
                      onClick={() => updateItemQty(item._id, item.newQty - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-xs font-extrabold text-white">
                      {item.newQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateItemQty(item._id, item.newQty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateItemQty(item._id, 0)}
                    title="Remove item"
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/15 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Reason for Change {hasRemovedItems ? '*' : '(Optional)'}
            </label>
            <input
              type="text"
              required={hasRemovedItems}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g. Guest changed mind / reduced quantity"
              className="w-full h-10 rounded-xl bg-surface-2 border border-border-subtle px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={hasRemovedItems && reason.trim().length < 2}
            >
              {activeItems.length === 0 ? 'Cancel Order' : 'Apply Changes'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
