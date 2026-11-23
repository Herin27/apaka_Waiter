import { cn } from '../../utils/cn';

const STATUS_MAP = {
  PLACED: {
    label: 'Placed',
    classes: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    dot: 'bg-amber-400',
  },
  CONFIRMED: {
    label: 'Confirmed',
    classes: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    dot: 'bg-sky-400',
  },
  PREPARING: {
    label: 'Preparing',
    classes: 'bg-accent/15 text-accent border-accent/40',
    dot: 'bg-accent animate-pulse',
  },
  READY: {
    label: 'Ready',
    classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    dot: 'bg-emerald-400 animate-pulse',
  },
  SERVED: {
    label: 'Served',
    classes: 'bg-teal-500/15 text-teal-300 border-teal-500/35',
    dot: 'bg-teal-400',
  },
  PAID: {
    label: 'Paid',
    classes: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/35',
    dot: 'bg-zinc-400',
  },
  REJECTED: {
    label: 'Rejected',
    classes: 'bg-red-500/15 text-red-400 border-red-500/35',
    dot: 'bg-red-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'bg-rose-500/15 text-rose-400 border-rose-500/35',
    dot: 'bg-rose-400',
  },
  EMPTY: {
    label: 'Empty',
    classes: 'bg-zinc-800/80 text-zinc-400 border-border-subtle',
    dot: 'bg-zinc-500',
  },
  SEATED: {
    label: 'Seated',
    classes: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
    dot: 'bg-indigo-400',
  },
  ORDERING: {
    label: 'Ordering',
    classes: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
    dot: 'bg-purple-400',
  },
  WAITING: {
    label: 'Waiting',
    classes: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    dot: 'bg-amber-400',
  },
  NEEDS_BILL: {
    label: 'Needs Bill',
    classes: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    dot: 'bg-cyan-400 animate-ping',
  },
  NEEDS_HELP: {
    label: 'Needs Help',
    classes: 'bg-red-500/20 text-red-300 border-red-500/45',
    dot: 'bg-red-500 animate-ping',
  },
};

export default function StatusPill({ status, className }) {
  const key = String(status || '').toUpperCase();
  const config = STATUS_MAP[key] || {
    label: key || 'Unknown',
    classes: 'bg-white/5 text-zinc-300 border-border-subtle',
    dot: 'bg-zinc-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.classes,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
