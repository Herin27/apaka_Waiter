import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-accent hover:bg-accent-hover text-white shadow-orange-glow border border-accent/60',
  secondary:
    'bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle',
  outline:
    'bg-transparent hover:bg-white/5 text-zinc-200 border border-border-strong',
  ghost:
    'bg-transparent hover:bg-white/5 text-zinc-300 border border-transparent',
  danger:
    'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
  success:
    'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30',
};

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-xl gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-2xl gap-2.5',
  icon: 'h-10 w-10 rounded-xl justify-center',
};

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
});

export default Button;
