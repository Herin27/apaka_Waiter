import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Modal({ open, onClose, title, description, children, className }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-surface-1 border border-border-strong p-6 shadow-card',
              className
            )}
          >
            <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
              <div>
                {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
                {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="overflow-y-auto pr-0.5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
