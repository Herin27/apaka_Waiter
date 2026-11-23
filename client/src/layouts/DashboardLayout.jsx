import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Utensils,
  ChefHat,
  Receipt,
  BookOpen,
  QrCode,
  Map as MapIcon,
  Users,
  Tag,
  Settings,
  History,
  BarChart3,
  Package,
  MessageSquareHeart,
  Award,
  Volume2,
  VolumeX,
  LogOut,
  Menu,
  X,
  CloudOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import BrandLogo from '../components/common/BrandLogo';
import Footer from '../components/common/Footer';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { disconnectSocket } from '../api/socket';
import { unlockAudio } from '../utils/sound';
import { getOfflineQueue, replayOfflineQueue } from '../utils/offlineQueue';
import { cn } from '../utils/cn';

const NAV_ITEMS = [
  {
    label: 'Waiter Floor',
    to: '/dashboard/waiter',
    icon: Utensils,
    roles: ['waiter', 'admin', 'superadmin'],
  },
  {
    label: 'Kitchen KDS',
    to: '/dashboard/kitchen',
    icon: ChefHat,
    roles: ['kitchen', 'admin', 'superadmin'],
  },
  {
    label: 'Cashier POS',
    to: '/dashboard/cashier',
    icon: Receipt,
    roles: ['cashier', 'admin', 'superadmin'],
  },
  {
    label: 'Admin Overview',
    to: '/dashboard/admin',
    end: true,
    icon: LayoutDashboard,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Analytics',
    to: '/dashboard/admin/analytics',
    icon: BarChart3,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Floor Editor',
    to: '/dashboard/admin/floor',
    icon: MapIcon,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Menu Manager',
    to: '/dashboard/admin/menu',
    icon: BookOpen,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Inventory',
    to: '/dashboard/admin/inventory',
    icon: Package,
    roles: ['admin', 'kitchen', 'superadmin'],
  },
  {
    label: 'Tables & QR',
    to: '/dashboard/admin/tables',
    icon: QrCode,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Staff & Roles',
    to: '/dashboard/admin/staff',
    icon: Users,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Coupons',
    to: '/dashboard/admin/coupons',
    icon: Tag,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Customers',
    to: '/dashboard/admin/customers',
    icon: Award,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Feedback',
    to: '/dashboard/admin/feedback',
    icon: MessageSquareHeart,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Settings',
    to: '/dashboard/admin/settings',
    icon: Settings,
    roles: ['admin', 'superadmin'],
  },
  {
    label: 'Activity Logs',
    to: '/dashboard/admin/logs',
    icon: History,
    roles: ['admin', 'superadmin'],
  },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const { user, logout } = useAuthStore();
  const { soundEnabled, toggleSound, socketConnected, language, setLanguage } = useUIStore();

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  useEffect(() => {
    getOfflineQueue().then((q) => setQueuedCount(q.length));

    const handleQueueChange = (e) => {
      setQueuedCount(e.detail?.count ?? 0);
    };

    const handleOnline = async () => {
      const res = await replayOfflineQueue();
      if (res.replayed > 0) {
        toast.success(`Synced ${res.replayed} offline action(s)!`);
      }
    };

    window.addEventListener('aw:offline-queue-changed', handleQueueChange);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('aw:offline-queue-changed', handleQueueChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
    toast.success('Logged out');
    navigate('/login', { replace: true });
  };

  const handleToggleSound = () => {
    unlockAudio();
    toggleSound();
    toast.success(!soundEnabled ? 'Notification sounds enabled' : 'Notification sounds muted');
  };

  const toggleStaffLang = () => {
    const next = language === 'hi' ? 'en' : 'hi';
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-screen flex bg-dotted-grid text-white">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-surface-1 border-r border-border-subtle z-30">
        <div className="flex h-16 items-center px-5 border-b border-border-subtle">
          <BrandLogo size="sm" />
        </div>

        <nav aria-label="Dashboard Sidebar" className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {allowedNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-accent text-white shadow-orange-glow'
                    : 'text-zinc-400 hover:bg-surface-2 hover:text-white'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border-subtle p-4">
          <div className="rounded-xl bg-surface-2 p-3 border border-border-subtle">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-zinc-400 capitalize mt-0.5">{user?.role}</p>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative z-10 w-64 bg-surface-1 border-r border-border-strong flex flex-col">
            <div className="flex h-16 items-center justify-between px-4 border-b border-border-subtle">
              <BrandLogo size="sm" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
              {allowedNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-accent text-white shadow-orange-glow'
                        : 'text-zinc-400 hover:bg-surface-2 hover:text-white'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <header className="sticky top-0 z-20 glass-surface border-b border-border-subtle h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-xl p-2 bg-surface-2 border border-border-subtle text-zinc-300 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <BrandLogo size="sm" showIcon={false} />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {queuedCount > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300">
                <CloudOff className="h-3.5 w-3.5" />
                <span>{queuedCount} queued</span>
              </div>
            )}

            <button
              type="button"
              onClick={toggleStaffLang}
              className="rounded-xl bg-surface-2 border border-border-subtle px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
            >
              {language === 'hi' ? 'हिं / EN' : 'EN / हिं'}
            </button>

            <div
              className="flex items-center gap-2 rounded-xl bg-surface-2 border border-border-subtle px-3 py-1.5 text-xs"
              title={socketConnected ? 'Realtime connected' : 'Realtime disconnected'}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                )}
              />
              <span className="hidden sm:inline text-zinc-300 font-medium">
                {socketConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={soundEnabled ? 'Mute alert sounds' : 'Unmute alert sounds'}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer',
                soundEnabled
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-surface-2 border-border-subtle text-zinc-500 hover:text-zinc-300'
              )}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-surface-2 border border-border-subtle px-3 py-1.5">
              <span className="text-xs font-semibold text-white">{user?.name}</span>
              <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                {user?.role}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-2 hover:bg-red-500/15 border border-border-subtle hover:border-red-500/35 px-3 text-xs font-medium text-zinc-300 hover:text-red-400 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}
