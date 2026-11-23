import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Edit3,
  BellRing,
  Droplets,
  Receipt,
  Sparkles,
  HelpCircle,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Utensils,
  Smartphone,
  Map as MapIcon,
  List,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useSocket } from '../api/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  Button,
  Card,
  Badge,
  StatusPill,
  CountdownTimer,
  EmptyState,
  Skeleton,
} from '../components/ui';
import { formatCurrency } from '../utils/formatters';
import { playNewOrder, playAlert } from '../utils/sound';
import { cn } from '../utils/cn';
import FloorMap from '../components/floor/FloorMap';
import RejectOrderModal from '../components/waiter/RejectOrderModal';
import EditOrderModal from '../components/waiter/EditOrderModal';
import WaiterOrderModal from '../components/waiter/WaiterOrderModal';
import TableDetailDrawer from '../components/waiter/TableDetailDrawer';

const TABLE_CHIP_STYLES = {
  EMPTY: 'bg-surface-2 text-zinc-400 border-border-subtle',
  SEATED: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  ORDERING: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  WAITING: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  PREPARING: 'bg-accent/20 text-accent border-accent/50',
  READY: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 animate-pulse',
  NEEDS_BILL: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
  NEEDS_HELP: 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse',
};

const CALL_ICONS = {
  WAITER: BellRing,
  WATER: Droplets,
  BILL: Receipt,
  CLEAN: Sparkles,
  HELP: HelpCircle,
};

function AutoConfirmCountdown({ createdAt, autoConfirmSeconds }) {
  const [leftSec, setLeftSec] = useState(0);

  useEffect(() => {
    if (!autoConfirmSeconds || autoConfirmSeconds <= 0) return;
    const target = new Date(createdAt).getTime() + autoConfirmSeconds * 1000;
    const tick = () => setLeftSec(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt, autoConfirmSeconds]);

  if (!autoConfirmSeconds || autoConfirmSeconds <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 border border-sky-500/35 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">
      <Clock className="h-3 w-3" />
      Auto {leftSec}s
    </span>
  );
}

export default function WaiterDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { soundEnabled, socketConnected, waiterViewMode, setWaiterViewMode } = useUIStore();
  const wakeLockActive = useWakeLock(true);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [calls, setCalls] = useState([]);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [flashingOrderIds, setFlashingOrderIds] = useState({});
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL');
  const [activeSearch, setActiveSearch] = useState('');

  const [rejectModalOrder, setRejectModalOrder] = useState(null);
  const [editModalOrder, setEditModalOrder] = useState(null);
  const [selectedTableDrawer, setSelectedTableDrawer] = useState(null);
  const [waiterOrderTable, setWaiterOrderTable] = useState(null);

  const prevConnectedRef = useRef(socketConnected);

  const fetchAllData = useCallback(async () => {
    try {
      const [ordersRes, callsRes, tablesRes, catsRes, itemsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/calls'),
        api.get('/tables'),
        api.get('/categories'),
        api.get('/menu-items?limit=100'),
      ]);

      setOrders(ordersRes.data.data.orders || []);
      setCalls(callsRes.data.data.calls || []);
      setTables(tablesRes.data.data.tables || []);
      setCategories(catsRes.data.data.categories || []);
      setMenuItems(itemsRes.data.data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load floor dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (socketConnected && !prevConnectedRef.current) {
      fetchAllData();
      toast.success('Live connection restored — floor synced');
    }
    prevConnectedRef.current = socketConnected;
  }, [socketConnected, fetchAllData]);

  const placedOrders = useMemo(
    () => orders.filter((o) => o.status === 'PLACED'),
    [orders]
  );

  useEffect(() => {
    if (placedOrders.length === 0 || !soundEnabled) return;

    const repeatTimer = setInterval(() => {
      playAlert();
    }, 10 * 1000);

    return () => clearInterval(repeatTimer);
  }, [placedOrders.length, soundEnabled]);

  useSocket('order:new', ({ order }) => {
    if (!order) return;
    setOrders((prev) => {
      const exists = prev.some((o) => o._id === order._id);
      return exists ? prev.map((o) => (o._id === order._id ? order : o)) : [order, ...prev];
    });

    if (order.status === 'PLACED') {
      setFlashingOrderIds((prev) => ({ ...prev, [order._id]: true }));
      setTimeout(() => {
        setFlashingOrderIds((prev) => {
          const next = { ...prev };
          delete next[order._id];
          return next;
        });
      }, 3000);

      if (soundEnabled) playNewOrder();
      toast.success(`New order ${order.orderNo} from Table ${order.tableId?.name || ''}!`);
    }
  });

  useSocket('order:updated', ({ order }) => {
    if (!order) return;
    setOrders((prev) => {
      const exists = prev.some((o) => o._id === order._id);
      return exists ? prev.map((o) => (o._id === order._id ? order : o)) : [order, ...prev];
    });
  });

  useSocket('table:updated', ({ table }) => {
    if (!table) return;
    setTables((prev) => prev.map((t) => (t._id === table._id ? { ...t, ...table } : t)));
    setSelectedTableDrawer((prev) => (prev && prev._id === table._id ? { ...prev, ...table } : prev));
  });

  useSocket('call:new', ({ call }) => {
    if (!call) return;
    setCalls((prev) => {
      const exists = prev.some((c) => c._id === call._id);
      return exists ? prev.map((c) => (c._id === call._id ? call : c)) : [call, ...prev];
    });
    if (soundEnabled) playAlert();
    toast(`Table ${call.tableId?.name || ''}: ${call.type} request`, { icon: '🔔' });
  });

  useSocket('call:updated', ({ call }) => {
    if (!call) return;
    setCalls((prev) => {
      if (call.status === 'RESOLVED') {
        return prev.filter((c) => c._id !== call._id);
      }
      return prev.map((c) => (c._id === call._id ? call : c));
    });
  });

  const handleConfirmOrder = async (orderId) => {
    const snapshot = orders;
    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, status: 'CONFIRMED' } : o))
    );

    try {
      const res = await api.patch(`/orders/${orderId}/confirm`);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? res.data.data.order : o))
      );
      toast.success('Order confirmed & sent to kitchen');
    } catch (err) {
      setOrders(snapshot);
      toast.error(err.response?.data?.message || 'Failed to confirm order');
    }
  };

  const handleRejectOrder = async (orderId, reason) => {
    const snapshot = orders;
    setOrders((prev) =>
      prev.map((o) =>
        o._id === orderId ? { ...o, status: 'REJECTED', rejectReason: reason } : o
      )
    );

    try {
      const res = await api.patch(`/orders/${orderId}/reject`, { reason });
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? res.data.data.order : o))
      );
      toast.success('Order rejected');
    } catch (err) {
      setOrders(snapshot);
      toast.error(err.response?.data?.message || 'Failed to reject order');
    }
  };

  const handleMarkServed = async (orderId) => {
    const snapshot = orders;
    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, status: 'SERVED' } : o))
    );

    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: 'SERVED' });
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? res.data.data.order : o))
      );
      toast.success('Marked as Served');
    } catch (err) {
      setOrders(snapshot);
      toast.error(err.response?.data?.message || 'Failed to mark order served');
    }
  };

  const handleSaveOrderEdits = async (order, draftItems, reason) => {
    const snapshot = orders;
    try {
      const keptItems = draftItems.filter((i) => !i.removed && i.newQty > 0);
      await api.patch(`/orders/${order._id}/cancel`, {
        reason: reason || 'Edited by waiter before preparation',
      });

      const recreated = await api.post('/orders', {
        tableId: order.tableId?._id || order.tableId,
        idempotencyKey: `edit_${order._id}_${Date.now()}`,
        items: keptItems.map((i) => ({
          menuItemId: i.menuItemId,
          qty: i.newQty,
          ...(i.variant?.name ? { variantName: i.variant.name } : {}),
          addonNames: (i.addons || []).map((a) => a.name),
          note: i.note || '',
        })),
      });

      toast.success(`Updated order placed as ${recreated.data.data.order.orderNo}`);
      await fetchAllData();
    } catch (err) {
      setOrders(snapshot);
      toast.error(err.response?.data?.message || 'Failed to update order');
    }
  };

  const handleCancelWholeOrder = async (orderId, reason) => {
    const snapshot = orders;
    setOrders((prev) =>
      prev.map((o) =>
        o._id === orderId ? { ...o, status: 'CANCELLED', cancelReason: reason } : o
      )
    );
    try {
      await api.patch(`/orders/${orderId}/cancel`, { reason });
      toast.success('Order cancelled');
    } catch (err) {
      setOrders(snapshot);
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  const handleAcknowledgeCall = async (callId) => {
    const snapshot = calls;
    setCalls((prev) =>
      prev.map((c) => (c._id === callId ? { ...c, status: 'ACKNOWLEDGED' } : c))
    );
    try {
      const res = await api.patch(`/calls/${callId}/acknowledge`);
      setCalls((prev) => prev.map((c) => (c._id === callId ? res.data.data.call : c)));
      toast.success('Call acknowledged');
    } catch (err) {
      setCalls(snapshot);
      toast.error(err.response?.data?.message || 'Failed to acknowledge call');
    }
  };

  const handleResolveCall = async (callId) => {
    const snapshot = calls;
    setCalls((prev) => prev.filter((c) => c._id !== callId));
    try {
      await api.patch(`/calls/${callId}/resolve`);
      toast.success('Call resolved');
    } catch (err) {
      setCalls(snapshot);
      toast.error(err.response?.data?.message || 'Failed to resolve call');
    }
  };

  const handleTransferTable = async (fromTableId, toTableId) => {
    try {
      const res = await api.post(`/tables/${fromTableId}/transfer`, { toTableId });
      toast.success(res.data.data.message);
      await fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to transfer table');
    }
  };

  const handleCloseSession = async (sessionId) => {
    try {
      const res = await api.post(`/sessions/${sessionId}/close`);
      toast.success(res.data.data.message);
      await fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close session');
    }
  };

  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'READY'),
    [orders]
  );

  const openCalls = useMemo(
    () => calls.filter((c) => ['OPEN', 'ACKNOWLEDGED'].includes(c.status)),
    [calls]
  );

  const activeOrdersFiltered = useMemo(() => {
    return orders.filter((o) => {
      if (!['CONFIRMED', 'PREPARING', 'SERVED'].includes(o.status)) return false;
      if (activeStatusFilter !== 'ALL' && o.status !== activeStatusFilter) return false;
      if (activeSearch.trim()) {
        const q = activeSearch.trim().toLowerCase();
        const tableMatch = (o.tableId?.name || '').toLowerCase().includes(q);
        const orderNoMatch = (o.orderNo || '').toLowerCase().includes(q);
        return tableMatch || orderNoMatch;
      }
      return true;
    });
  }, [orders, activeStatusFilter, activeSearch]);

  const branchName = user?.branch?.name || 'Demo Cafe Branch';
  const autoConfirmSeconds = user?.restaurant?.settings?.autoConfirmSeconds || 0;

  const itemAllergenMap = useMemo(() => {
    const map = new Map();
    menuItems.forEach((m) => {
      if (m.allergens?.length > 0) map.set(String(m._id), m.allergens);
    });
    return map;
  }, [menuItems]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Subheader with Map View / List View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/35 text-accent">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-white">{branchName}</h1>
            <p className="text-xs text-zinc-400">
              Waiter Floor Console • {placedOrders.length} pending • {readyOrders.length} ready •{' '}
              {openCalls.length} calls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Map View / List View Switcher */}
          <div className="inline-flex items-center rounded-xl bg-surface-2 border border-border-subtle p-1">
            <button
              type="button"
              onClick={() => setWaiterViewMode('map')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer',
                waiterViewMode === 'map'
                  ? 'bg-accent text-white shadow-orange-glow'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Map View
            </button>
            <button
              type="button"
              onClick={() => setWaiterViewMode('list')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer',
                waiterViewMode === 'list'
                  ? 'bg-accent text-white shadow-orange-glow'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              <List className="h-3.5 w-3.5" />
              List View
            </button>
          </div>

          {wakeLockActive && (
            <Badge tone="green">
              <Smartphone className="h-3 w-3" />
              Screen Awake
            </Badge>
          )}
          <Button variant="secondary" size="sm" onClick={fetchAllData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* HOME VIEW MODE 1: LIVE 3D FLOOR MAP */}
      {waiterViewMode === 'map' && (
        <FloorMap
          tables={tables}
          onSelectTable={(tbl) => setSelectedTableDrawer(tbl)}
          enableSocket={true}
        />
      )}

      {/* HOME VIEW MODE 2: COMPACT TABLES STRIP */}
      {waiterViewMode === 'list' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Tables Overview (Tap a table for session &amp; actions)
            </h2>
            <span className="text-[11px] text-zinc-500">{tables.length} Tables</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {tables.map((t) => (
              <button
                key={t._id}
                type="button"
                onClick={() => setSelectedTableDrawer(t)}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 shrink-0 transition active:scale-95 cursor-pointer',
                  TABLE_CHIP_STYLES[t.status] || TABLE_CHIP_STYLES.EMPTY
                )}
              >
                <span className="text-sm font-extrabold">{t.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  {t.status.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Three-Column Live Operations Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface-1 border border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-sm font-extrabold text-white">New Orders</h2>
            </div>
            <Badge tone="amber">{placedOrders.length}</Badge>
          </div>

          {placedOrders.length === 0 ? (
            <EmptyState
              title="No new orders"
              description="Incoming QR table orders will flash and chime here."
              className="py-8"
            />
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-3">
                {placedOrders.map((order) => {
                  const isFlashing = Boolean(flashingOrderIds[order._id]);
                  return (
                    <motion.div
                      key={order._id}
                      layout
                      initial={{ opacity: 0, y: -18, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Card
                        glow={isFlashing}
                        className={cn(
                          'p-4 space-y-3 transition-all',
                          isFlashing
                            ? 'border-accent bg-accent/10 animate-pulse'
                            : 'border-amber-500/35'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-xl bg-accent px-2.5 py-1 text-xs font-extrabold text-white">
                              {order.tableId?.name || 'Table'}
                            </span>
                            <span className="text-sm font-extrabold text-white">
                              {order.orderNo}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <AutoConfirmCountdown
                              createdAt={order.createdAt}
                              autoConfirmSeconds={autoConfirmSeconds}
                            />
                            <CountdownTimer createdAt={order.createdAt} warnAfterMinutes={5} />
                          </div>
                        </div>

                        <div className="space-y-2 border-y border-border-subtle py-2.5">
                          {order.items?.map((item) => {
                            const allergens = itemAllergenMap.get(String(item.menuItemId)) || [];
                            return (
                              <div key={item._id} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-white">
                                    {item.qty}× {item.name}
                                  </span>
                                  <span className="text-zinc-400">
                                    {formatCurrency(item.price * item.qty)}
                                  </span>
                                </div>
                                {item.variant?.name && (
                                  <p className="text-[11px] text-zinc-400">
                                    Variant: {item.variant.name}
                                  </p>
                                )}
                                {item.addons?.length > 0 && (
                                  <p className="text-[11px] text-zinc-400">
                                    + {item.addons.map((a) => a.name).join(', ')}
                                  </p>
                                )}
                                {item.note && (
                                  <p className="text-[11px] font-semibold text-amber-300">
                                    Note: “{item.note}”
                                  </p>
                                )}
                                {allergens.length > 0 && (
                                  <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-300">
                                    <AlertTriangle className="h-3 w-3" />
                                    Allergens: {allergens.join(', ')}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleConfirmOrder(order._id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Confirm
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditModalOrder(order)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setRejectModalOrder(order)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface-1 border border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="text-sm font-extrabold text-white">Ready to Serve</h2>
            </div>
            <Badge tone="green">{readyOrders.length}</Badge>
          </div>

          {readyOrders.length === 0 ? (
            <EmptyState
              title="Nothing waiting to serve"
              description="Orders marked Ready by the kitchen will pulse green here."
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {readyOrders.map((order) => (
                <Card
                  key={order._id}
                  className="p-4 space-y-3 border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_24px_-4px_rgba(16,185,129,0.45)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-emerald-500 px-2.5 py-1 text-xs font-extrabold text-black">
                        {order.tableId?.name || 'Table'}
                      </span>
                      <span className="text-sm font-extrabold text-white">{order.orderNo}</span>
                    </div>
                    <CountdownTimer createdAt={order.createdAt} warnAfterMinutes={10} />
                  </div>

                  <div className="space-y-1 border-y border-emerald-500/25 py-2.5">
                    {order.items?.map((item) => (
                      <p key={item._id} className="text-xs font-semibold text-white">
                        {item.qty}× {item.name}
                      </p>
                    ))}
                  </div>

                  <Button
                    variant="success"
                    size="md"
                    className="w-full font-bold bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400"
                    onClick={() => handleMarkServed(order._id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Served
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface-1 border border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-extrabold text-white">Table Calls</h2>
            </div>
            <Badge tone="orange">{openCalls.length}</Badge>
          </div>

          {openCalls.length === 0 ? (
            <EmptyState
              title="No active calls"
              description="Water, bill, clean, and help requests appear here."
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {openCalls.map((call) => {
                const Icon = CALL_ICONS[call.type] || BellRing;
                const isAck = call.status === 'ACKNOWLEDGED';

                return (
                  <Card
                    key={call._id}
                    className={cn(
                      'p-4 space-y-3',
                      isAck ? 'border-sky-500/35' : 'border-accent/50 bg-accent/5'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-white">
                            Table {call.tableId?.name || ''}
                          </p>
                          <p className="text-xs font-semibold text-accent">{call.type}</p>
                        </div>
                      </div>

                      <CountdownTimer createdAt={call.createdAt} warnAfterMinutes={3} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isAck}
                        onClick={() => handleAcknowledgeCall(call._id)}
                      >
                        {isAck ? 'Acknowledged' : 'Acknowledge'}
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleResolveCall(call._id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Active Orders List */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-white">Active Floor Orders</h2>
            <p className="text-xs text-zinc-400">
              Live status of Confirmed, Preparing, and Served orders
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'CONFIRMED', 'PREPARING', 'SERVED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setActiveStatusFilter(st)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer',
                  activeStatusFilter === st
                    ? 'bg-accent text-white shadow-orange-glow'
                    : 'bg-surface-2 text-zinc-400 hover:text-white'
                )}
              >
                {st}
              </button>
            ))}

            <div className="relative w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
                placeholder="Search table or order #..."
                className="w-full h-9 rounded-xl bg-surface-2 border border-border-subtle pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {activeOrdersFiltered.length === 0 ? (
          <EmptyState
            title="No matching active orders"
            description="Confirmed, preparing, and served orders will appear in this list."
            className="py-8"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeOrdersFiltered.map((order) => (
              <div
                key={order._id}
                className="rounded-2xl bg-surface-2 border border-border-subtle p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-surface-3 px-2 py-0.5 text-xs font-extrabold text-white">
                        {order.tableId?.name || 'Table'}
                      </span>
                      <span className="text-xs font-bold text-zinc-300">{order.orderNo}</span>
                    </div>
                    <StatusPill status={order.status} />
                  </div>

                  <p className="text-xs text-zinc-300 line-clamp-2">
                    {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
                  <span className="font-bold text-white">{formatCurrency(order.total)}</span>
                  <div className="flex items-center gap-2">
                    {order.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => setEditModalOrder(order)}
                        className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    <CountdownTimer createdAt={order.createdAt} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <RejectOrderModal
        order={rejectModalOrder}
        open={Boolean(rejectModalOrder)}
        onClose={() => setRejectModalOrder(null)}
        onConfirmReject={handleRejectOrder}
      />

      <EditOrderModal
        order={editModalOrder}
        open={Boolean(editModalOrder)}
        onClose={() => setEditModalOrder(null)}
        onSaveEdits={handleSaveOrderEdits}
        onCancelWholeOrder={handleCancelWholeOrder}
      />

      <TableDetailDrawer
        table={selectedTableDrawer}
        allTables={tables}
        orders={orders}
        open={Boolean(selectedTableDrawer)}
        onClose={() => setSelectedTableDrawer(null)}
        onOpenWaiterOrder={(tbl) => setWaiterOrderTable(tbl)}
        onTransferTable={handleTransferTable}
        onCloseSession={handleCloseSession}
      />

      <WaiterOrderModal
        open={Boolean(waiterOrderTable)}
        onClose={() => setWaiterOrderTable(null)}
        table={waiterOrderTable}
        categories={categories}
        menuItems={menuItems}
        onOrderCreated={(created) => {
          setOrders((prev) => [created, ...prev]);
        }}
      />
    </div>
  );
}
