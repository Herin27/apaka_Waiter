import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

const Select = forwardRef(function Select(
  { label, error, options = [], children, className, id, ...props },
  ref
) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full h-11 appearance-none rounded-xl bg-surface-2 border border-border-subtle px-3.5 pr-9 text-sm text-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition',
            error && 'border-red-500/60',
            className
          )}
          {...props}
        >
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-2 text-white">
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
});

export default Select;
