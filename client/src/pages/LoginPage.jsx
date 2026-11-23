import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Sparkles, UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';
import Footer from '../components/common/Footer';
import { Button, Card, Input } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { getRoleHomePath } from '../utils/formatters';
import { unlockAudio } from '../utils/sound';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@demo.com', badge: 'Full Access' },
  { role: 'Waiter', email: 'waiter@demo.com', badge: 'Floor & Tables' },
  { role: 'Kitchen', email: 'kitchen@demo.com', badge: 'KDS Tickets' },
  { role: 'Cashier', email: 'cashier@demo.com', badge: 'POS & Billing' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleAutofill = (demoEmail) => {
    unlockAudio();
    setEmail(demoEmail);
    setPassword('Demo@123');
    toast.success(`Filled ${demoEmail}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    unlockAudio();

    if (!email.trim() || !password) {
      toast.error('Please enter your email and password.');
      return;
    }

    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(getRoleHomePath(user.role), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dotted-grid text-white relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[380px] w-[380px] rounded-full bg-accent/20 blur-[120px]"
      />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 border border-accent/40 text-accent shadow-orange-glow">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              <span className="text-white">Aapka</span>{' '}
              <span className="text-accent">waiter</span>
            </h1>
            <p className="text-xs text-zinc-400">
              Sign in to manage floor operations, kitchen tickets, and billing
            </p>
          </div>

          <Card glow className="p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                label="Staff Email"
                type="email"
                placeholder="admin@demo.com"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-zinc-400 hover:text-white transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full mt-2"
              >
                Sign In to Dashboard
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Sparkles className="h-3 w-3 text-accent" />
                  Quick Demo Login (Demo@123)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleAutofill(acc.email)}
                    className="group flex flex-col items-start rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle hover:border-accent/45 p-2.5 text-left transition cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-accent transition">
                        {acc.role}
                      </span>
                      <span className="text-[10px] text-zinc-500">{acc.badge}</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 truncate w-full mt-0.5">
                      {acc.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
