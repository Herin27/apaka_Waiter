import { cn } from '../../utils/cn';

export default function Card({ children, className, elevated = false, glow = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border-subtle transition-colors',
        elevated ? 'bg-surface-2' : 'bg-surface-1',
        glow && 'shadow-orange-glow border-accent/35',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
