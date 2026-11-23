import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  Flame,
  CheckCircle2,
  Play,
  RotateCcw,
  Printer,
  Maximize2,
  Minimize2,
  Search,
  AlertTriangle,
  WifiOff,
  Volume2,
  VolumeX,
  Smartphone,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useSocket } from '../api/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { useWakeLock } from '../hooks/useWakeLock';
import { Button, Card, Badge, EmptyState, Skeleton } from '../components/ui';
import { playNewOrder, playAlert, unlockAudio } from '../utils/sound';
import { cn } from '../utils/cn';
import KotPrintSheet from '../components/kitchen/KotPrintSheet';

export const KDS_TIMER_THRESHOLDS = {
  WARNING_MINUTES: 10,
  CRITICAL_MINUTES: 15,
};

const STATIONS = [
  { value: 'ALL', label: 'All Stations' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'BAR', label: 'Bar' },
  { value: 'PASTRY', label: 'Pastry' },
];

function KdsElapsedBadge({ createdAt, onLateDetected }) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    createdAt ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)) : 0
  );
  const lateNotifiedRef = useRef(false);

  useEffect(() => {
    if (!createdAt) return;
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
      setElapsedSec(sec);
      const mins = Math.floor(sec / 60);
      if (mins > KDS_TIMER_THRESHOLDS.CRITICAL_MINUTES && !lateNotifiedRef.current) {
        lateNotifiedRef.current = true;
        onLateDetected?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [createdAt, onLateDetected]);

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;

  let colorClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
  if (mins > KDS_TIMER_THRESHOLDS.CRITICAL_MINUTES) {
    colorClass = 'bg-red-500/20 text-red-300 border-red-500/55 animate-pulse';
  } else if (mins >= KDS_TIMER_THRESHOLDS.WARNING_MINUTES) {
    colorClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 font-mono text-sm font-extrabold',
        colorClass
      )}
    >
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

export default function KitchenDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { soundEnabled, toggleSound, socketConnected, kdsStation, setKdsStation } = useUIStore();
  const wakeLockActive = useWakeLock(true);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [showStockDrawer, setShowStockDrawer] = useState(false);

  const [rushOrderIds, setRushOrderIds] = useState({});
  const [undoBanner, setUndoBanner] = useState(null);
  const undoTimerRef = useRef(null);

  const [printOrder, setPrintOrder] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const prevConnectedRef = useRef(socketConnected);

  const fetchKdsData = useCallback(async () => {
    try {
      const [ordersRes, menuRes] = await Promise.all([
        api.get('/orders?status=CONFIRMED,PREPARING,READY'),
        api.get('/menu-items?limit=100'),
      ]);
      setOrders(ordersRes.data.data.orders || []);
      setMenuItems(menuRes.data.data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync KDS tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKdsData();
  }, [fetchKdsData]);

  useEffect(() => {
    if (socketConnected && !prevConnectedRef.current) {
      fetchKdsData();
      toast.success('KDS reconnected — tickets synced');
    }
    prevConnectedRef.current = socketConnected;
  }, [socketConnected, fetchKdsData]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    unlockAudio();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error('Fullscreen mode not supported by this browser');
    }
  };

  useSocket('order:new', ({ order }) => {
    if (!order) return;
    if (['CONFIRMED', 'PREPARING', 'READY'].includes(order.status)) {
      setOrders((prev) => {
        const exists = prev.some((o) => o._id === order._id);
        return exists ? prev.map((o) => (o._id === order._id ? order : o)) : [...prev, order];
      });
      if (soundEnabled) playNewOrder();
    }
  });

  useSocket('order:updated', ({ order }) => {
    if (!order) return;
    setOrders((prev) => {
      const isKdsRelevant = ['CONFIRMED', 'PREPARING', 'READY'].includes(order.status);
      const exists = prev.some((o) => o._id === order._id);

      if (!isKdsRelevant) {
        return prev.filter((o) => o._id !== order._id);
      }

      if (!exists && order.status === 'CONFIRMED' && soundEnabled) {
        playNewOrder();
      }

      return exists ? prev.map((o) => (o._id === order._id ? order : o)) : [...prev, order];
    });
  });

  useSocket('menu:availability', ({ itemId, isAvailable }) => {
    if (!itemId) return;
    setMenuItems((prev) =>
      prev.map((m) => (m._id === itemId ? { ...m, isAvailable } : m))
    );
  });

  const triggerUndoOption = (label, undoFn) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoBanner({ label, undoFn });
    undoTimerRef.current = setTimeout(() => {
      setUndoBanner(null);
    }, 10 * 1000);
  };

  const handleExecuteUndo = async () => {
    if (!undoBanner?.undoFn) return;
    const fn = undoBanner.undoFn;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoBanner(null);
    await fn();
  };

  const getStationItems = useCallback(
    (order) => {
      const activeItems = (order.items || []).filter(
        (i) => !['CANCELLED', 'REJECTED'].includes(i.status)
      );
      if (kdsStation === 'ALL') return activeItems;
      return activeItems.filter((i) => i.station === kdsStation);
    },
    [kdsStation]
  );

  const handleAdvanceOrderStation = async (order, nextStatus) => {
    unlockAudio();
    const stationItems = getStationItems(order);
    if (!stationItems.length) return;

    const prevItemsSnapshot = order.items.map((i) => ({ _id: i._id, status: i.status }));

    try {
      if (kdsStation === 'ALL' || stationItems.length === order.items.length) {
        const res = await api.patch(`/orders/${order._id}/status`, { status: nextStatus });
        setOrders((prev) =>
          prev.map((o) => (o._id === order._id ? res.data.data.order : o))
        );
      } else {
        let latestOrder = order;
        for (const item of stationItems) {
          if (item.status !== nextStatus) {
            const res = await api.patch(`/orders/${order._id}/items/${item._id}/status`, {
              status: nextStatus,
            });
            latestOrder = res.data.data.order;
          }
        }
        setOrders((prev) => prev.map((o) => (o._id === order._id ? latestOrder : o)));
      }

      toast.success(`${order.orderNo} (${kdsStation}) → ${nextStatus}`);

      triggerUndoOption(`Moved ${order.orderNo} to ${nextStatus}`, async () => {
        try {
          let restoredOrder = order;
          for (const snap of prevItemsSnapshot) {
            const res = await api.patch(`/orders/${order._id}/items/${snap._id}/status`, {
              status: snap.status,
            });
            restoredOrder = res.data.data.order;
          }
          setOrders((prev) => prev.map((o) => (o._id === order._id ? restoredOrder : o)));
          toast.success(`Undid change on ${order.orderNo}`);
        } catch (err) {
          toast.error(err.response?.data?.message || 'Could not undo change');
          fetchKdsData();
        }
      });
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to update ${order.orderNo}`);
    }
  };

  const handleToggleItemReady = async (order, item) => {
    unlockAudio();
    const prevStatus = item.status;
    const nextStatus = item.status === 'READY' ? 'PREPARING' : 'READY';

    try {
      const res = await api.patch(`/orders/${order._id}/items/${item._id}/status`, {
        status: nextStatus,
      });
      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? res.data.data.order : o))
      );

      triggerUndoOption(`${item.name} → ${nextStatus}`, async () => {
        try {
          const undoRes = await api.patch(`/orders/${order._id}/items/${item._id}/status`, {
            status: prevStatus,
          });
          setOrders((prev) =>
            prev.map((o) => (o._id === order._id ? undoRes.data.data.order : o))
          );
          toast.success(`Reverted ${item.name}`);
        } catch {
          fetchKdsData();
        }
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle item status');
    }
  };

  const handleToggleMenuAvailability = async (menuItem) => {
    const nextAvail = !menuItem.isAvailable;
    setMenuItems((prev) =>
      prev.map((m) => (m._id === menuItem._id ? { ...m, isAvailable: nextAvail } : m))
    );

    try {
      await api.patch(`/menu-items/${menuItem._id}/availability`, { isAvailable: nextAvail });
      toast.success(`${menuItem.name?.en} is now ${nextAvail ? 'Available' : 'Out of Stock'}`);
    } catch (err) {
      setMenuItems((prev) =>
        prev.map((m) => (m._id === menuItem._id ? { ...m, isAvailable: !nextAvail } : m))
      );
      toast.error(err.response?.data?.message || 'Failed to update stock status');
    }
  };

  const toggleRushFlag = (orderId) => {
    setRushOrderIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handlePrintKot = (order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleLateOrderAlarm = useCallback(() => {
    if (soundEnabled) {
      playAlert();
    }
  }, [soundEnabled]);

  const itemAllergenMap = useMemo(() => {
    const map = new Map();
    menuItems.forEach((m) => {
      if (m.allergens?.length > 0) map.set(String(m._id), m.allergens);
    });
    return map;
  }, [menuItems]);

  const { newTickets, preparingTickets, readyTickets, totalToCook } = useMemo(() => {
    const sortTickets = (list) =>
      [...list].sort((a, b) => {
        const aRush = rushOrderIds[a._id] ? 1 : 0;
        const bRush = rushOrderIds[b._id] ? 1 : 0;
        if (aRush !== bRush) return bRush - aRush;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const newList = [];
    const prepList = [];
    const readyList = [];
    const cookAggregator = new Map();

    for (const order of orders) {
      const stationItems = getStationItems(order);
      if (stationItems.length === 0) continue;

      const allReady = stationItems.every((i) => ['READY', 'SERVED'].includes(i.status));
      const anyPreparing = stationItems.some((i) => i.status === 'PREPARING');

      if (order.status === 'READY' || allReady) {
        readyList.push({ ...order, stationItems });
      } else if (order.status === 'PREPARING' || anyPreparing) {
        prepList.push({ ...order, stationItems });
      } else {
        newList.push({ ...order, stationItems });
      }

      for (const item of stationItems) {
        if (['CONFIRMED', 'PREPARING'].includes(item.status)) {
          const key = `${item.name}${item.variant?.name ? ` (${item.variant.name})` : ''}`;
          cookAggregator.set(key, (cookAggregator.get(key) || 0) + item.qty);
        }
      }
    }

    const aggregatedList = Array.from(cookAggregator.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    return {
      newTickets: sortTickets(newList),
      preparingTickets: sortTickets(prepList),
      readyTickets: sortTickets(readyList),
      totalToCook: aggregatedList,
    };
  }, [orders, getStationItems, rushOrderIds]);

  const filteredStockItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((m) => (m.name?.en || '').toLowerCase().includes(q));
  }, [menuItems, menuSearch]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const renderTicketCard = (order, columnType) => {
    const isRush = Boolean(rushOrderIds[order._id]);

    return (
      <motion.div
        key={order._id}
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={cn(
            'p-5 space-y-4 border-2 transition-all',
            isRush
              ? 'border-red-500 bg-red-500/10 shadow-[0_0_28px_-4px_rgba(239,68,68,0.5)]'
              : columnType === 'NEW'
              ? 'border-sky-500/45 bg-surface-1'
              : columnType === 'PREPARING'
              ? 'border-accent/55 bg-surface-1'
              : 'border-emerald-500/50 bg-emerald-500/5'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="rounded-xl bg-accent px-3 py-1.5 text-base font-black text-white shadow-orange-glow">
                {order.tableId?.name || 'Table'}
              </span>
              <span className="text-lg font-black tracking-tight text-white">
                {order.orderNo}
              </span>
              {isRush && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2 py-0.5 text-xs font-black uppercase text-white animate-pulse">
                  <Flame className="h-3.5 w-3.5" />
                  RUSH
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <KdsElapsedBadge
                createdAt={order.createdAt}
                onLateDetected={handleLateOrderAlarm}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => toggleRushFlag(order._id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-bold transition cursor-pointer',
                isRush
                  ? 'bg-red-500/20 border-red-500 text-red-300'
                  : 'bg-surface-2 border-border-subtle text-zinc-400 hover:text-white'
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              {isRush ? 'Priority Rush On' : 'Mark Rush'}
            </button>

            <button
              type="button"
              onClick={() => handlePrintKot(order)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-2.5 py-1 font-bold text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-accent" />
              Print KOT
            </button>
          </div>

          <div className="space-y-2.5 border-y border-border-subtle py-3">
            {order.stationItems.map((item) => {
              const isItemReady = item.status === 'READY' || item.status === 'SERVED';
              const allergens = itemAllergenMap.get(String(item.menuItemId)) || [];

              return (
                <div
                  key={item._id}
                  onClick={() => handleToggleItemReady(order, item)}
                  className={cn(
                    'rounded-xl border p-3 transition cursor-pointer select-none',
                    isItemReady
                      ? 'bg-emerald-500/15 border-emerald-500/45'
                      : 'bg-surface-2 hover:bg-surface-3 border-border-subtle'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p
                        className={cn(
                          'text-base font-extrabold leading-snug',
                          isItemReady ? 'line-through text-emerald-300' : 'text-white'
                        )}
                      >
                        {item.qty}× {item.name}
                      </p>

                      {item.variant?.name && (
                        <p className="text-xs font-semibold text-sky-300">
                          Size: {item.variant.name}
                        </p>
                      )}

                      {item.addons?.length > 0 && (
                        <p className="text-xs font-medium text-zinc-300">
                          + {item.addons.map((a) => a.name).join(', ')}
                        </p>
                      )}

                      {item.note && (
                        <p className="rounded-lg bg-amber-500/15 border border-amber-500/35 px-2 py-1 text-xs font-bold text-amber-300">
                          NOTE: {item.note}
                        </p>
                      )}

                      {allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {allergens.map((al) => (
                            <span
                              key={al}
                              className="inline-flex items-center gap-1 rounded-md bg-red-500/20 border border-red-500/45 px-2 py-0.5 text-[11px] font-bold text-red-300"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {al}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="rounded-md bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
                        {item.station}
                      </span>
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg border',
                          isItemReady
                            ? 'bg-emerald-500 border-emerald-400 text-black'
                            : 'bg-surface-1 border-border-strong text-zinc-500'
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {columnType === 'NEW' && (
            <Button
              variant="primary"
              size="lg"
              className="w-full text-base font-extrabold"
              onClick={() => handleAdvanceOrderStation(order, 'PREPARING')}
            >
              <Play className="h-5 w-5" />
              Start Cooking
            </Button>
          )}

          {columnType === 'PREPARING' && (
            <Button
              variant="success"
              size="lg"
              className="w-full text-base font-extrabold bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400"
              onClick={() => handleAdvanceOrderStation(order, 'READY')}
            >
              <CheckCircle2 className="h-5 w-5" />
              Mark Ready
            </Button>
          )}

          {columnType === 'READY' && (
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/35 py-2.5 text-center text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              Ready for Waiter Pickup
            </div>
          )}
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      {!socketConnected && (
        <div className="flex items-center justify-between rounded-2xl bg-red-500/20 border border-red-500/50 px-4 py-3 text-sm font-bold text-red-200">
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-red-400" />
            Offline — Attempting to reconnect to live kitchen feed...
          </span>
          <Button size="sm" variant="secondary" onClick={fetchKdsData}>
            Retry Sync
          </Button>
        </div>
      )}

      <AnimatePresence>
        {undoBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 border border-accent px-5 py-3 shadow-orange-glow"
          >
            <span className="text-sm font-bold text-white">{undoBanner.label}</span>
            <Button size="sm" variant="primary" onClick={handleExecuteUndo}>
              <RotateCcw className="h-4 w-4" />
              Undo (10s)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 pr-2">
            <ChefHat className="h-6 w-6 text-accent" />
            <span className="text-base font-black text-white">KDS</span>
          </div>

          {STATIONS.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => {
                unlockAudio();
                setKdsStation(st.value);
              }}
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-extrabold transition cursor-pointer',
                kdsStation === st.value
                  ? 'bg-accent text-white shadow-orange-glow'
                  : 'bg-surface-2 text-zinc-400 hover:text-white'
              )}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {wakeLockActive && (
            <Badge tone="green">
              <Smartphone className="h-3.5 w-3.5" />
              Awake
            </Badge>
          )}

          <Button
            variant={showStockDrawer ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setShowStockDrawer((prev) => !prev)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Stock Control ({menuItems.filter((m) => !m.isAvailable).length} Out)
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              unlockAudio();
              toggleSound();
            }}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-accent" />
            ) : (
              <VolumeX className="h-4 w-4 text-zinc-500" />
            )}
            {soundEnabled ? 'Sound On' : 'Muted'}
          </Button>

          <Button variant="secondary" size="md" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
            <Layers className="h-4 w-4" />
            Total to Cook ({kdsStation})
          </span>
          <span className="text-xs text-zinc-500">
            Aggregated across {newTickets.length + preparingTickets.length} active tickets
          </span>
        </div>

        {totalToCook.length === 0 ? (
          <p className="text-xs text-zinc-500">All stations clear — zero items pending prep.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {totalToCook.map((agg) => (
              <div
                key={agg.name}
                className="inline-flex items-center gap-2 rounded-xl bg-surface-2 border border-border-strong px-3.5 py-2"
              >
                <span className="rounded-lg bg-accent px-2 py-0.5 text-sm font-black text-white">
                  {agg.qty}×
                </span>
                <span className="text-sm font-bold text-white">{agg.name}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showStockDrawer && (
        <Card glow className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-white">
                Live Menu Availability (86 / Out-of-Stock Switch)
              </h2>
              <p className="text-xs text-zinc-400">
                Turning an item off immediately updates all customer QR menus in real time.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Search dish to toggle..."
                className="w-full h-10 rounded-xl bg-surface-2 border border-border-subtle pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {filteredStockItems.map((item) => (
              <div
                key={item._id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl border p-3 transition',
                  item.isAvailable
                    ? 'bg-surface-2 border-border-subtle'
                    : 'bg-red-500/10 border-red-500/40'
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{item.name?.en}</p>
                  <p className="text-[11px] text-zinc-400">
                    {item.isAvailable ? 'In Stock' : 'Marked Unavailable'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleMenuAvailability(item)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer',
                    item.isAvailable ? 'bg-emerald-500' : 'bg-zinc-700'
                  )}
                  aria-label={`Toggle ${item.name?.en}`}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                      item.isAvailable ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface-1 border border-sky-500/35 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sky-400 animate-pulse" />
              <h2 className="text-base font-black tracking-wide text-white">NEW</h2>
            </div>
            <Badge tone="blue">{newTickets.length}</Badge>
          </div>

          {newTickets.length === 0 ? (
            <EmptyState
              title="No new tickets"
              description="Confirmed orders from waiters will appear here."
              className="py-10"
            />
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-4">
                {newTickets.map((ord) => renderTicketCard(ord, 'NEW'))}
              </div>
            </AnimatePresence>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface-1 border border-accent/40 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-accent animate-pulse" />
              <h2 className="text-base font-black tracking-wide text-white">PREPARING</h2>
            </div>
            <Badge tone="orange">{preparingTickets.length}</Badge>
          </div>

          {preparingTickets.length === 0 ? (
            <EmptyState
              title="Nothing on the stove"
              description="Tap 'Start Cooking' on a new ticket to move it here."
              className="py-10"
            />
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-4">
                {preparingTickets.map((ord) => renderTicketCard(ord, 'PREPARING'))}
              </div>
            </AnimatePresence>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface-1 border border-emerald-500/40 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <h2 className="text-base font-black tracking-wide text-white">READY</h2>
            </div>
            <Badge tone="green">{readyTickets.length}</Badge>
          </div>

          {readyTickets.length === 0 ? (
            <EmptyState
              title="No completed tickets"
              description="Completed tickets notify the waiter floor instantly."
              className="py-10"
            />
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-4">
                {readyTickets.map((ord) => renderTicketCard(ord, 'READY'))}
              </div>
            </AnimatePresence>
          )}
        </section>
      </div>

      <KotPrintSheet
        order={printOrder}
        restaurantName={user?.restaurant?.name}
        branchName={user?.branch?.name}
        station={kdsStation}
      />
    </div>
  );
}
