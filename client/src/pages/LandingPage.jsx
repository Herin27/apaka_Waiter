import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  QrCode,
  ChefHat,
  Receipt,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  Send,
  Users,
  BarChart3,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import BrandLogo from '../components/common/BrandLogo';
import Footer from '../components/common/Footer';
import { Button, Card, Badge, Input } from '../components/ui';
import api from '../api/axios';

const STEPS = [
  {
    num: '01',
    title: 'Scan',
    desc: 'Guests scan the table QR code with any smartphone camera — no app download or login required.',
  },
  {
    num: '02',
    title: 'Order',
    desc: 'Friends build a live shared table cart together in English, Hindi, or Gujarati and send straight to KDS.',
  },
  {
    num: '03',
    title: 'Enjoy',
    desc: 'Track live kitchen preparation, call waiters with one tap, and split or pay the GST bill seamlessly.',
  },
];

const FEATURES = [
  { title: '3D Live Floor Map', desc: 'Real-time table states and glowing Kitchen-to-Table order beams.', icon: Sparkles },
  { title: 'Shared Group Cart', desc: 'Multiple guests at one table add and edit items simultaneously.', icon: Users },
  { title: 'Station Kitchen KDS', desc: 'Dedicated Kitchen, Bar & Pastry tickets with timers and 80mm KOT.', icon: ChefHat },
  { title: 'Split & GST Billing', desc: 'Equal or guest split, coupons, Razorpay checkout, and PDF invoices.', icon: Receipt },
  { title: 'Offline PWA Queue', desc: 'Resilient offline caching and queued staff actions on reconnect.', icon: Smartphone },
  { title: 'Analytics & AI', desc: 'Peak-hour heatmaps, inventory auto-deduction, and voice ordering.', icon: BarChart3 },
];

const ROLES = [
  { role: 'Customer', desc: 'Scan QR, browse multilingual menu, shared cart, live tracker & bill pay.' },
  { role: 'Waiter', desc: 'Confirm/edit orders, serve ready dishes, handle calls, transfer/close tables.' },
  { role: 'Kitchen', desc: 'Station KDS board, elapsed timers, 10s undo, stock toggle & 80mm KOT.' },
  { role: 'Cashier', desc: 'Open table bills, coupons, split/mixed payments, PDF invoices & Z-report.' },
  { role: 'Owner / Admin', desc: 'Floor editor, menu & CSV, staff roles, inventory, loyalty & analytics.' },
];

const PLANS = [
  {
    name: 'Starter',
    price: '₹1,499',
    period: '/month',
    desc: 'Ideal for single-outlet cafes & bistros up to 15 tables.',
    features: ['Up to 15 QR Tables', 'Live Shared Cart & Tracker', 'Kitchen KDS & 80mm KOT', 'GST PDF Invoices'],
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '₹2,999',
    period: '/month',
    desc: 'Built for busy restaurants wanting AI voice ordering, loyalty & analytics.',
    features: ['Unlimited Tables & Floor Map', 'AI Voice Order & Upsells', 'Inventory & Recipe Auto-Deduct', '30-Day Analytics & Loyalty'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'Multi-branch hospitality groups with superadmin governance & priority support.',
    features: ['Multi-Branch & Superadmin', 'Custom Webhooks & ERP Export', 'Dedicated Onboarding', '99.9% Uptime SLA'],
    highlighted: false,
  },
];

const FAQS = [
  {
    q: 'Do customers need to install an app or create an account?',
    a: 'No. Customers simply scan the table QR code in their camera or browser to start a live table session immediately.',
  },
  {
    q: 'What happens if internet drops mid-service?',
    a: 'Menus are cached via PWA service workers and staff status updates queue automatically in IndexedDB to sync on reconnect.',
  },
  {
    q: 'Does it support split bills, coupons, and Razorpay payments?',
    a: 'Yes. Bills support promo coupons, equal or guest splits, mixed Cash/UPI/Card payments, Razorpay test & live checkout, and GST PDFs.',
  },
];

export default function LandingPage() {
  const [openFaqIdx, setOpenFaqIdx] = useState(0);
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    restaurantName: '',
    tablesCount: 12,
    planInterest: 'GROWTH',
    notes: '',
  });
  const [submittingLead, setSubmittingLead] = useState(false);

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.name.trim() || !leadForm.email.trim() || !leadForm.restaurantName.trim()) {
      toast.error('Please fill in your name, email, and restaurant name.');
      return;
    }
    setSubmittingLead(true);
    try {
      const res = await api.post('/public/leads', leadForm);
      toast.success(res.data.data.message);
      setLeadForm({
        name: '',
        email: '',
        phone: '',
        restaurantName: '',
        tablesCount: 12,
        planInterest: 'GROWTH',
        notes: '',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit request');
    } finally {
      setSubmittingLead(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dotted-grid text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-surface border-b border-border-subtle">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2.5">
            <Link to="/demo">
              <Button variant="secondary" size="sm">
                <QrCode className="h-3.5 w-3.5 text-accent" />
                Live Demo
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="primary" size="sm">
                Staff Login
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 space-y-20">
        {/* Hero with Animated Mini Floor Map Preview */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-6 space-y-6"
          >
            <Badge tone="orange">QR Table Ordering • KDS • Billing • AI</Badge>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
              <span className="text-white">Aapka</span>{' '}
              <span className="text-accent">waiter</span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
              Turn every restaurant table into an instant, shared ordering experience synced live
              with your floor map, kitchen display system, and cashier billing desk.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a href="#request-demo">
                <Button size="lg">
                  Request a Demo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link to="/demo">
                <Button variant="secondary" size="lg">
                  Try Interactive Table Demo
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Animated Floor Map Hero Visual */}
          <div className="lg:col-span-6">
            <Card glow className="p-5 relative overflow-hidden">
              <div className="rounded-2xl bg-surface-2 border border-accent/40 py-2 px-4 text-center text-[11px] font-black tracking-[0.2em] uppercase text-accent mb-6">
                KITCHEN &amp; PASS COUNTER
              </div>

              <div className="grid grid-cols-3 gap-4 py-4">
                {[
                  { name: 'T1', status: 'WAITING', color: 'border-amber-400 bg-amber-500/15 text-amber-200' },
                  { name: 'T2', status: 'PREPARING', color: 'border-accent bg-accent/20 text-orange-200' },
                  { name: 'T3', status: 'READY', color: 'border-emerald-400 bg-emerald-500/20 text-emerald-200 animate-pulse' },
                ].map((tbl, idx) => (
                  <motion.div
                    key={tbl.name}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, delay: idx * 0.35 }}
                    className={`flex flex-col items-center justify-center h-24 rounded-2xl border-2 ${tbl.color}`}
                  >
                    <span className="text-base font-black">{tbl.name}</span>
                    <span className="text-[10px] font-bold uppercase mt-1">{tbl.status}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* How It Works: 3 Steps */}
        <section className="space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">How It Works</h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              From QR scan to kitchen plate in seconds
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((st) => (
              <Card key={st.num} className="p-6 space-y-2.5">
                <span className="text-xs font-black tracking-widest text-accent">{st.num}</span>
                <h3 className="text-xl font-extrabold text-white">{st.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{st.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Feature Grid */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center">
            Built for High-Velocity Hospitality
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-5 space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-white">{f.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Role Cards */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center">
            Dedicated Workspaces for Every Role
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {ROLES.map((r) => (
              <Card key={r.role} className="p-4 space-y-1.5">
                <Badge tone="orange">{r.role}</Badge>
                <p className="text-xs text-zinc-400 leading-relaxed pt-1">{r.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* 3 Pricing Plans */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center">
            Transparent Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                glow={plan.highlighted}
                className="p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-white">{plan.name}</h3>
                    {plan.highlighted && <Badge tone="orange">Most Popular</Badge>}
                  </div>
                  <div>
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    <span className="text-xs text-zinc-400">{plan.period}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{plan.desc}</p>
                  <ul className="space-y-2 pt-2 text-xs text-zinc-200">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-accent shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a href="#request-demo" className="block">
                  <Button
                    variant={plan.highlighted ? 'primary' : 'secondary'}
                    className="w-full"
                  >
                    Choose {plan.name}
                  </Button>
                </a>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4 max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-extrabold text-white text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2.5">
            {FAQS.map((item, idx) => {
              const open = openFaqIdx === idx;
              return (
                <Card key={item.q} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(open ? -1 : idx)}
                    className="flex w-full items-center justify-between p-4 text-left text-sm font-bold text-white cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-accent transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 text-xs text-zinc-400 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* Demo Request Form */}
        <section id="request-demo" className="max-w-2xl mx-auto w-full">
          <Card glow className="p-6 sm:p-8 space-y-4">
            <div className="text-center space-y-1">
              <Badge tone="orange">Free Live Walkthrough</Badge>
              <h2 className="text-2xl font-extrabold text-white">Request a Demo</h2>
              <p className="text-xs text-zinc-400">
                Tell us about your cafe or restaurant and we will set up a live sandbox.
              </p>
            </div>

            <form onSubmit={handleLeadSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Your Name *"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((p) => ({ ...p, name: e.target.value }))}
                />
                <Input
                  label="Work Email *"
                  type="email"
                  required
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Restaurant / Cafe Name *"
                  required
                  value={leadForm.restaurantName}
                  onChange={(e) => setLeadForm((p) => ({ ...p, restaurantName: e.target.value }))}
                />
                <Input
                  label="Phone Number"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>

              <textarea
                rows={2}
                value={leadForm.notes}
                onChange={(e) => setLeadForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Number of tables, current POS, or questions..."
                className="w-full rounded-xl bg-surface-2 border border-border-subtle p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submittingLead}
                className="w-full"
              >
                <Send className="h-4 w-4" />
                Submit Demo Request
              </Button>
            </form>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
