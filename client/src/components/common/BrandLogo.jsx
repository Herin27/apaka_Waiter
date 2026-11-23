import { UtensilsCrossed } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function BrandLogo({ size = 'md', showIcon = true, className }) {
  const sizeStyles = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      {showIcon && (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 border border-accent/40 text-accent shadow-orange-glow">
          <UtensilsCrossed className="h-4 w-4" />
        </span>
      )}
      <span className={cn('font-extrabold tracking-tight leading-none', sizeStyles[size])}>
        <span className="text-white">Aapka</span>{' '}
        <span className="text-accent">waiter</span>
      </span>
    </div>
  );
}
