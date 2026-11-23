import { useState } from 'react';
import {
  Users,
  PlusCircle,
  ArrowRightLeft,
  DoorClosed,
  Receipt,
} from 'lucide-react';
import { Drawer, Button, StatusPill, Badge, Select } from '../ui';
import { formatCurrency } from '../../utils/formatters';

export default function TableDetailDrawer({
  table,
  allTables = [],
  orders = [],
  open,
  onClose,
  onOpenWaiterOrder,
  onTransferTable,
  onCloseSession,
}) {
  const [transferTargetId, setTransferTargetId] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  if (!table) return null;

  const tableOrders = orders.filter(
    (o) => String(o.tableId?._id || o.tableId) === String(table._id)
  );

  const activeOrders = tableOrders.filter(
    (o) => !['REJECTED', 'CANCELLED'].includes(o.status)
  );

  const sessionTotal = activeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const latestOrder = tableOrders[0] || null;
  const activeSessionId = latestOrder?.sessionId || null;

  const uniqueGuests = Array.from(
    new Set(
      tableOrders
        .flatMap((o) => o.items?.map((i) => i.addedByGuest) || [])
        .filter(Boolean)
    )
  );

  const emptyTables = allTables.filter(
    (t) => t._id !== table._id && t.status === 'EMPTY' && t.isActive
  );

  const handleTransfer = async () => {
    if (!transferTargetId) return;
    setBusyAction(true);
    try {
      await onTransferTable(table._id, transferTargetId);
      setTransferTargetId('');
      onClose();
    } finally {
      setBusyAction(false);
    }
  };

  const handleCloseTableSession = async () => {
    if (!activeSessionId) return;
    setBusyAction(true);
    try {
      await onCloseSession(activeSessionId);
      onClose();
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Table ${table.name} (${table.section})`}
      footer={
        <div className="space-y-2.5">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => {
              onClose();
              onOpenWaiterOrder(table);
            }}
          >
            <PlusCircle className="h-4 w-4" />
            Place Order for Customer
          </Button>

          {activeSessionId && (
            <Button
              variant="danger"
              size="md"
              loading={busyAction}
              className="w-full"
              onClick={handleCloseTableSession}
            >
              <DoorClosed className="h-4 w-4" />
              Close Session &amp; Reset Table
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-surface-2 border border-border-subtle p-3">
            <p className="text-[11px] text-zinc-400">Status</p>
            <div className="mt-1">
              <StatusPill status={table.status} />
            </div>
          </div>

          <div className="rounded-xl bg-surface-2 border border-border-subtle p-3">
            <p className="text-[11px] text-zinc-400">Capacity</p>
            <p className="mt-1 text-sm font-extrabold text-white">{table.seats} Seats</p>
          </div>

          <div className="rounded-xl bg-surface-2 border border-border-subtle p-3">
            <p className="text-[11px] text-zinc-400">Running Tab</p>
            <p className="mt-1 text-sm font-extrabold text-accent">
              {formatCurrency(sessionTotal)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Users className="h-3.5 w-3.5 text-accent" />
            Active Guests
          </h4>
          {uniqueGuests.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {uniqueGuests.map((g) => (
                <Badge key={g} tone="neutral">
                  {g}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {table.status === 'EMPTY'
                ? 'Table is currently vacant.'
                : 'Guests seated via QR scan.'}
            </p>
          )}
        </div>

        {table.status !== 'EMPTY' && emptyTables.length > 0 && (
          <div className="rounded-2xl bg-surface-2 border border-border-subtle p-3.5 space-y-2.5">
            <h4 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
              <ArrowRightLeft className="h-3.5 w-3.5 text-accent" />
              Transfer Table Session
            </h4>
            <div className="flex items-center gap-2">
              <Select
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                options={[
                  { value: '', label: 'Select empty table...' },
                  ...emptyTables.map((t) => ({
                    value: t._id,
                    label: `Table ${t.name} (${t.seats} seats • ${t.section})`,
                  })),
                ]}
              />
              <Button
                variant="secondary"
                disabled={!transferTargetId}
                loading={busyAction}
                onClick={handleTransfer}
              >
                Move
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Receipt className="h-3.5 w-3.5 text-accent" />
            Orders ({tableOrders.length})
          </h4>

          {tableOrders.length === 0 ? (
            <p className="text-xs text-zinc-500 rounded-xl bg-surface-2/60 p-4 text-center">
              No orders recorded for this table yet.
            </p>
          ) : (
            <div className="space-y-2">
              {tableOrders.map((ord) => (
                <div
                  key={ord._id}
                  className="rounded-xl bg-surface-2 border border-border-subtle p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">{ord.orderNo}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-200">
                        {formatCurrency(ord.total)}
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
          )}
        </div>
      </div>
    </Drawer>
  );
}
