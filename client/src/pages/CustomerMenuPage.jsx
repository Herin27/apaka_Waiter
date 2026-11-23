import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  ShoppingBag,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  UtensilsCrossed,
  CreditCard,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useSocket } from '../api/socket';
import { useSessionStore } from '../store/useSessionStore';
import { useUIStore } from '../store/useUIStore';
import { Button, Card, Skeleton, EmptyState } from '../components/ui';
import { formatCurrency, getLocalizedText } from '../utils/formatters';
import { unlockAudio } from '../utils/sound';
import WelcomeSplash from '../components/customer/WelcomeSplash';
import MenuItemCard from '../components/customer/MenuItemCard';
import ItemDetailDrawer from '../components/customer/ItemDetailDrawer';
import FilterDrawer from '../components/customer/FilterDrawer';
import CartDrawer from '../components/customer/CartDrawer';
import OrderTrackerView from '../components/customer/OrderTrackerView';
import CallWaiterSheet from '../components/customer/CallWaiterSheet';
import PayBillAndFeedbackView from '../components/customer/PayBillAndFeedbackView';

const DEFAULT_FILTERS = {
  isVeg: false,
  isVegan: false,
  isJain: false,
  spiceLevel: null,
  excludeAllergens: [],
};

export default function CustomerMenuPage() {
  const { branchSlug, token: qrToken } = useParams();

  const language = useUIStore((s) => s.language);
  const {
    sessionToken,
    sessionId,
    branchSlug: storedSlug,
    qrToken: storedQrToken,
    guest,
    table,
    cart,
    subtotal,
    setSession,
    setCart,
    setTable,
  } = useSessionStore();

  const [bootState, setBootState] = useState('loading');
  const [bootError, setBootError] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const [restaurant, setRestaurant] = useState(null);
  const [branch, setBranch] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);

  // 'splash' | 'menu' | 'tracker' | 'bill'
  const [activeView, setActiveView] = useState('splash');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccessBanner, setOrderSuccessBanner] = useState(null);

  const [callCooldowns, setCallCooldowns] = useState({});

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const hasActive = Object.values(callCooldowns).some((v) => v > 0);
    if (!hasActive) return;

    const timer = setInterval(() => {
      setCallCooldowns((prev) => {
        const next = {};
        for (const [key, val] of Object.entries(prev)) {
          if (val > 1) next[key] = val - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [callCooldowns]);

  const fetchSessionOrders = useCallback(async () => {
    try {
      const res = await api.get('/public/orders');
      setOrders(res.data.data.orders || []);
    } catch {
      // Ignore if no orders yet
    }
  }, []);

  const bootstrapTableSession = useCallback(async () => {
    setBootState('loading');
    setBootError('');

    try {
      const menuRes = await api.get(`/public/menu/${branchSlug}/${qrToken}`);
      const menuData = menuRes.data.data;

      setRestaurant(menuData.restaurant);
      setBranch(menuData.branch);
      setCategories(menuData.categories || []);
      setItems(menuData.items || []);

      const isSameQr =
        sessionToken && storedSlug === branchSlug && storedQrToken === qrToken;

      if (isSameQr) {
        try {
          const cartRes = await api.get('/public/session/cart');
          setCart(cartRes.data.data.cart, cartRes.data.data.subtotal);
          setTable(menuData.table);
          await fetchSessionOrders();
          setBootState('ready');
          return;
        } catch {
          // Stored session expired or closed
        }
      }

      const startRes = await api.post('/public/session/start', {
        branchSlug,
        qrToken,
      });

      const started = startRes.data.data;
      setSession({
        sessionToken: started.sessionToken,
        session: started.session,
        guest: started.guest,
        table: started.table,
        branchSlug,
        qrToken,
      });
      setOrders([]);
      setBootState('ready');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Unable to load table menu. Please check your connection or scan the QR code again.';
      setBootError(msg);
      setBootState('error');
    }
  }, [
    branchSlug,
    qrToken,
    sessionToken,
    storedSlug,
    storedQrToken,
    setSession,
    setCart,
    setTable,
    fetchSessionOrders,
  ]);

  useEffect(() => {
    bootstrapTableSession();
  }, [bootstrapTableSession]);

  useSocket(
    'cart:updated',
    (payload) => {
      if (payload?.cart) {
        setCart(payload.cart, payload.subtotal);
      }
    },
    { mode: 'customer', enabled: Boolean(sessionToken) }
  );

  useSocket(
    'order:updated',
    (payload) => {
      if (!payload?.order) return;
      setOrders((prev) => {
        const exists = prev.some((o) => o._id === payload.order._id);
        if (exists) {
          return prev.map((o) => (o._id === payload.order._id ? payload.order : o));
        }
        return [payload.order, ...prev];
      });
    },
    { mode: 'customer', enabled: Boolean(sessionToken) }
  );

  useSocket(
    'menu:availability',
    (payload) => {
      if (!payload?.itemId) return;
      setItems((prev) =>
        prev.map((item) =>
          item._id === payload.itemId ? { ...item, isAvailable: payload.isAvailable } : item
        )
      );
    },
    { mode: 'customer', enabled: Boolean(sessionToken) }
  );

  useSocket(
    'table:updated',
    (payload) => {
      if (payload?.table) {
        setTable(payload.table);
      }
    },
    { mode: 'customer', enabled: Boolean(sessionToken) }
  );

  useSocket(
    'bill:paid',
    () => {
      setActiveView('bill');
    },
    { mode: 'customer', enabled: Boolean(sessionToken) }
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'ALL') {
        const catId = item.categoryId?._id || item.categoryId;
        if (String(catId) !== String(selectedCategory)) return false;
      }
      if (filters.isVeg && !item.isVeg) return false;
      if (filters.isVegan && !item.isVegan) return false;
      if (filters.isJain && !item.isJain) return false;

      if (filters.spiceLevel !== null) {
        if (filters.spiceLevel === 2) {
          if ((item.spiceLevel || 0) < 2) return false;
        } else if ((item.spiceLevel || 0) !== filters.spiceLevel) {
          return false;
        }
      }

      if (filters.excludeAllergens.length > 0 && item.allergens?.length > 0) {
        const itemAllergensLower = item.allergens.map((a) => a.toLowerCase());
        const hasExcluded = filters.excludeAllergens.some((ex) =>
          itemAllergensLower.includes(ex.toLowerCase())
        );
        if (hasExcluded) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameEn = (item.name?.en || '').toLowerCase();
        const nameHi = (item.name?.hi || '').toLowerCase();
        const nameGu = (item.name?.gu || '').toLowerCase();
        const descEn = (item.description?.en || '').toLowerCase();
        const matchesTag = (item.tags || []).some((t) => t.toLowerCase().includes(q));
        if (
          !nameEn.includes(q) &&
          !nameHi.includes(q) &&
          !nameGu.includes(q) &&
          !descEn.includes(q) &&
          !matchesTag
        ) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedCategory, filters, searchQuery]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.isVeg) count++;
    if (filters.isVegan) count++;
    if (filters.isJain) count++;
    if (filters.spiceLevel !== null) count++;
    count += filters.excludeAllergens.length;
    return count;
  }, [filters]);

  const handleAddToCart = async (payload) => {
    unlockAudio();
    setAddingToCart(true);
    try {
      const res = await api.post('/public/session/cart', payload);
      setCart(res.data.data.cart, res.data.data.subtotal);
      setSelectedItem(null);
      toast.success('Added to shared table cart');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add item to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleUpdateCartQty = async (cartItemId, newQty) => {
    try {
      const res = await api.patch(`/public/session/cart/${cartItemId}`, { qty: newQty });
      setCart(res.data.data.cart, res.data.data.subtotal);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update quantity');
    }
  };

  const handleRemoveCartItem = async (cartItemId) => {
    try {
      const res = await api.delete(`/public/session/cart/${cartItemId}`);
      setCart(res.data.data.cart, res.data.data.subtotal);
      toast.success('Item removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove item');
    }
  };

  const handlePlaceOrder = async () => {
    if (placingOrder || cart.length === 0) return;
    unlockAudio();
    setPlacingOrder(true);

    const idempotencyKey = `ord_${sessionId || 'sess'}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    try {
      const res = await api.post('/public/orders', { idempotencyKey });
      const { order } = res.data.data;

      setCart([], 0);
      setCartDrawerOpen(false);
      setOrders((prev) => {
        const exists = prev.some((o) => o._id === order._id);
        return exists ? prev : [order, ...prev];
      });

      setOrderSuccessBanner(order.orderNo);
      setTimeout(() => {
        setOrderSuccessBanner(null);
        setActiveView('tracker');
      }, 1400);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order. Please retry.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleTriggerWaiterCall = async (type) => {
    unlockAudio();
    try {
      await api.post('/public/calls', { type });
      setCallCooldowns((prev) => ({ ...prev, [type]: 60 }));
      toast.success(
        type === 'BILL'
          ? 'Bill requested! Opening bill summary...'
          : 'Staff notified! Someone is on the way.'
      );
      if (type === 'BILL') {
        setActiveView('bill');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to send request';
      toast.error(msg);
      const match = msg.match(/(\d+)\s*seconds/);
      if (match) {
        setCallCooldowns((prev) => ({ ...prev, [type]: Number(match[1]) }));
      }
    }
  };

  const currency = restaurant?.currency || 'INR';
  const taxPercent = restaurant?.settings?.taxPercent ?? restaurant?.taxPercent ?? 5;
  const serviceChargePercent =
    restaurant?.settings?.serviceChargePercent ?? restaurant?.serviceChargePercent ?? 0;

  const totalCartItems = cart.reduce((sum, i) => sum + i.qty, 0);
  const estimatedTotal =
    subtotal + (subtotal * taxPercent) / 100 + (subtotal * serviceChargePercent) / 100;

  if (bootState === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
          <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
          <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="w-full p-7 text-center space-y-4 border-red-500/35">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400 border border-red-500/30">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-white">Table QR Unavailable</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{bootError}</p>
          <Button variant="primary" size="md" onClick={bootstrapTableSession} className="w-full">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {isOffline && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-red-500/15 border border-red-500/40 px-4 py-2.5 text-xs text-red-200">
          <span className="inline-flex items-center gap-2 font-semibold">
            <WifiOff className="h-4 w-4 text-red-400" />
            You are offline. Reconnecting automatically...
          </span>
        </div>
      )}

      <AnimatePresence>
        {orderSuccessBanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9 }}
              className="rounded-3xl bg-surface-1 border border-emerald-500/40 p-8 text-center shadow-card max-w-xs w-full space-y-3"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Order Placed!</h3>
              <p className="text-xs text-zinc-400">
                Ticket <span className="text-accent font-bold">{orderSuccessBanner}</span> sent to
                the kitchen.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeView === 'splash' && (
        <WelcomeSplash
          restaurant={restaurant}
          branch={branch}
          table={table}
          guest={guest}
          onViewMenu={() => {
            unlockAudio();
            setActiveView(orders.length > 0 ? 'tracker' : 'menu');
          }}
        />
      )}

      {activeView !== 'splash' && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-surface-1 border border-border-subtle p-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveView('menu')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                activeView === 'menu'
                  ? 'bg-accent text-white shadow-orange-glow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Menu
            </button>

            <button
              type="button"
              onClick={() => {
                fetchSessionOrders();
                setActiveView('tracker');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                activeView === 'tracker'
                  ? 'bg-accent text-white shadow-orange-glow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Orders
              {orders.length > 0 && (
                <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px]">
                  {orders.length}
                </span>
              )}
            </button>

            {orders.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveView('bill')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  activeView === 'bill'
                    ? 'bg-accent text-white shadow-orange-glow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Pay Bill
              </button>
            )}
          </div>

          <span className="text-[11px] text-zinc-400 pr-2 truncate">
            {guest?.nickname || 'Guest 1'}
          </span>
        </div>
      )}

      {activeView === 'menu' && (
        <div className="space-y-4 pb-28">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes, ingredients, tags..."
                className="w-full h-11 rounded-2xl bg-surface-1 border border-border-subtle pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="relative flex h-11 items-center gap-1.5 rounded-2xl bg-surface-1 hover:bg-surface-2 border border-border-subtle px-3.5 text-xs font-bold text-zinc-200 transition cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="sticky top-14 z-20 -mx-4 px-4 py-2.5 glass-surface border-b border-border-subtle">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-accent text-white shadow-orange-glow'
                    : 'bg-surface-2 text-zinc-400 hover:text-white'
                }`}
              >
                All ({items.length})
              </button>

              {categories.map((cat) => {
                const isSelected = String(selectedCategory) === String(cat._id);
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setSelectedCategory(cat._id)}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-accent text-white shadow-orange-glow'
                        : 'bg-surface-2 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {getLocalizedText(cat.name, language)}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              title="No matching dishes"
              description="Try clearing your search or adjusting your dietary filters."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setFilters(DEFAULT_FILTERS);
                  }}
                >
                  Clear Search &amp; Filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item._id}
                  item={item}
                  language={language}
                  currency={currency}
                  onSelect={(clicked) => setSelectedItem(clicked)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'tracker' && (
        <OrderTrackerView
          orders={orders}
          currency={currency}
          onAddMoreItems={() => setActiveView('menu')}
          onRequestBill={() => setActiveView('bill')}
          billCooldown={0}
        />
      )}

      {activeView === 'bill' && (
        <PayBillAndFeedbackView
          sessionId={sessionId}
          guestName={guest?.nickname || 'Guest 1'}
          onBackToTracker={() => setActiveView('tracker')}
        />
      )}

      {activeView !== 'splash' && activeView !== 'bill' && (
        <CallWaiterSheet
          cooldowns={callCooldowns}
          onTriggerCall={handleTriggerWaiterCall}
        />
      )}

      {activeView !== 'splash' && activeView !== 'bill' && totalCartItems > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-accent hover:bg-accent-hover text-white px-5 py-3.5 shadow-orange-glow-lg transition active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/25 font-extrabold text-sm">
                  {totalCartItems}
                </span>
                <div className="text-left">
                  <p className="text-xs font-extrabold uppercase tracking-wide">
                    View Shared Cart
                  </p>
                  <p className="text-[11px] text-white/85">
                    Est. {formatCurrency(estimatedTotal, currency)} incl. taxes
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 text-sm font-extrabold">
                Checkout
                <ShoppingBag className="h-4 w-4" />
              </span>
            </button>
          </div>
        </div>
      )}

      <ItemDetailDrawer
        item={selectedItem}
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        language={language}
        currency={currency}
        onAddToCart={handleAddToCart}
        submitting={addingToCart}
      />

      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <CartDrawer
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        cart={cart}
        subtotal={subtotal}
        taxPercent={taxPercent}
        serviceChargePercent={serviceChargePercent}
        currency={currency}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onPlaceOrder={handlePlaceOrder}
        placingOrder={placingOrder}
      />
    </div>
  );
}
