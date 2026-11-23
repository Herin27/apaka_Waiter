import { cn } from '../../utils/cn';

export default function Footer({ className }) {
  return (
    <footer
      className={cn(
        'w-full py-4 px-4 text-center text-xs text-zinc-500 border-t border-border-subtle bg-bg-primary/60',
        className
      )}
    >
      Designed &amp; Developed by{' '}
      <span className="font-semibold text-accent">HeryxStudio</span>
    </footer>
  );
}
