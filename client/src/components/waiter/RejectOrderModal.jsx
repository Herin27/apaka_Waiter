import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../ui';

const QUICK_REASONS = [
  'Item out of stock in kitchen',
  'Kitchen closing / last order passed',
  'Duplicate order placed by mistake',
  'Customer requested cancellation',
];

export default function RejectOrderModal({ order, open, onClose, onConfirmReject }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirmReject(order._id, reason.trim());
      setReason('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reject Order ${order.orderNo}`}
      description={`Table ${order.tableId?.name || ''} — Provide a clear reason shown to the customer.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className="rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white transition cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-300">
            Rejection Reason *
          </label>
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for rejecting this order..."
            className="w-full rounded-xl bg-surface-2 border border-border-subtle p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Keep Order
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={submitting}
            disabled={reason.trim().length < 2}
          >
            <AlertTriangle className="h-4 w-4" />
            Reject Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
