import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function CountdownTimer({ createdAt, warnAfterMinutes = 15, className }) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    createdAt ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)) : 0
  );

  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const isOverdue = mins >= warnAfterMinutes;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-xs font-semibold border',
        isOverdue
          ? 'bg-red-500/15 text-red-400 border-red-500/35 animate-pulse'
          : 'bg-surface-2 text-zinc-300 border-border-subtle',
        className
      )}
    >
      <Clock className="h-3 w-3" />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}
