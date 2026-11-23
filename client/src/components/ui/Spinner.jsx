import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Spinner({ size = 'md', label, className }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  };

  return (
    <div className={cn('inline-flex items-center gap-2.5 text-zinc-300', className)}>
      <Loader2 className={cn('animate-spin text-accent', sizes[size] || sizes.md)} />
      {label && <span className="text-xs font-medium text-zinc-400">{label}</span>}
    </div>
  );
}
