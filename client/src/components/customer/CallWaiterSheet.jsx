import { useState } from 'react';
import { BellRing, Droplets, Receipt, Sparkles, HelpCircle } from 'lucide-react';
import { Drawer } from '../ui';
import { cn } from '../../utils/cn';

const CALL_OPTIONS = [
  { type: 'WAITER', label: 'Call Waiter', desc: 'Need assistance at your table', icon: BellRing },
  { type: 'WATER', label: 'Water & Cutlery', desc: 'Request drinking water or plates', icon: Droplets },
  { type: 'BILL', label: 'Request Bill', desc: 'Ready to settle your table tab', icon: Receipt },
  { type: 'CLEAN', label: 'Clean Table', desc: 'Clear used plates or wipe table', icon: Sparkles },
  { type: 'HELP', label: 'Urgent Help', desc: 'Speak with manager or staff', icon: HelpCircle },
];

export default function CallWaiterSheet({ cooldowns = {}, onTriggerCall }) {
  const [open, setOpen] = useState(false);

  const activeCooldownValues = Object.values(cooldowns).filter((sec) => sec > 0);
  const minCooldown = activeCooldownValues.length > 0 ? Math.min(...activeCooldownValues) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-surface-2 hover:bg-surface-3 text-white border border-accent/60 px-4 py-2.5 text-xs font-bold shadow-orange-glow transition active:scale-95 cursor-pointer"
      >
        <BellRing className="h-4 w-4 text-accent animate-bounce" />
        <span>{minCooldown > 0 ? `Waiter (${minCooldown}s)` : 'Call Waiter'}</span>
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="How can we assist you?">
        <div className="grid grid-cols-1 gap-2.5">
          {CALL_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const remaining = cooldowns[opt.type] || 0;
            const disabled = remaining > 0;

            return (
              <button
                key={opt.type}
                type="button"
                disabled={disabled}
                onClick={async () => {
                  await onTriggerCall(opt.type);
                  setOpen(false);
                }}
                className={cn(
                  'flex items-center justify-between rounded-2xl border p-3.5 text-left transition',
                  disabled
                    ? 'bg-surface-2/40 border-border-subtle opacity-60 cursor-not-allowed'
                    : 'bg-surface-2 hover:bg-surface-3 border-border-subtle hover:border-accent/50 cursor-pointer'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-xs text-zinc-400">{opt.desc}</p>
                  </div>
                </div>

                {disabled && (
                  <span className="rounded-lg bg-surface-1 border border-border-strong px-2.5 py-1 font-mono text-xs font-bold text-accent">
                    {remaining}s
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}
