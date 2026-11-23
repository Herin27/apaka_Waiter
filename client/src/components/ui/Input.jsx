import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const Input = forwardRef(function Input(
  { label, error, icon: Icon, rightElement, className, id, ...props },
  ref
) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-500" />
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full h-11 rounded-xl bg-surface-2 border border-border-subtle px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition',
            Icon && 'pl-10',
            rightElement && 'pr-10',
            error && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          {...props}
        />
        {rightElement && <div className="absolute right-3 flex items-center">{rightElement}</div>}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
});

export default Input;
