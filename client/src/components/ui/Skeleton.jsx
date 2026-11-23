import { cn } from '../../utils/cn';

export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-surface-2 border border-border-subtle',
        className
      )}
    />
  );
}
