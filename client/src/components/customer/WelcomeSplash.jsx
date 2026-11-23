import { motion } from 'framer-motion';
import { UtensilsCrossed, ArrowRight, Sparkles, MapPin } from 'lucide-react';
import { Button, Card } from '../ui';

export default function WelcomeSplash({ restaurant, branch, table, guest, onViewMenu }) {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center py-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full"
      >
        <Card glow className="relative overflow-hidden p-7 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-accent/25 blur-3xl"
          />

          <div className="relative z-10 flex flex-col items-center space-y-5">
            {restaurant?.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="h-16 w-16 rounded-2xl object-cover border border-border-strong shadow-card"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 border border-accent/40 text-accent shadow-orange-glow">
                <UtensilsCrossed className="h-8 w-8" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                {restaurant?.name || 'Welcome to'}
              </p>
              <h2 className="text-lg font-bold text-white">{branch?.name}</h2>
              {branch?.address && (
                <p className="inline-flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                  <MapPin className="h-3 w-3 text-accent shrink-0" />
                  <span className="line-clamp-1">{branch.address}</span>
                </p>
              )}
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-accent/15 border border-accent/45 px-5 py-2 shadow-orange-glow">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-base font-extrabold tracking-wide text-white">
                Table {table?.name}
              </span>
              {table?.section && (
                <span className="text-xs font-medium text-zinc-300">• {table.section}</span>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4 }}
              className="pt-1 space-y-1.5"
            >
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                <span className="text-white">Aapka</span>{' '}
                <span className="text-accent">waiter</span>
              </h1>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Joined as <span className="text-white font-semibold">{guest?.nickname || 'Guest 1'}</span>.
                Browse our menu, customize dishes, and order straight to your table.
              </p>
            </motion.div>

            <div className="w-full pt-2">
              <Button size="lg" className="w-full text-base" onClick={onViewMenu}>
                View Menu
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
