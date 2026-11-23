import { cn } from '../../utils/cn';

const tones = {
  neutral: 'bg-white/5 text-zinc-300 border-border-subtle',
  orange: 'bg-accent/15 text-accent border-accent/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

export default function Badge({ children, tone = 'neutral', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
