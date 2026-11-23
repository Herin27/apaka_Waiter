import { cn } from '../../utils/cn';

export default function Tabs({ tabs = [], activeTab, onChange, className }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-2xl bg-surface-1 p-1 border border-border-subtle overflow-x-auto max-w-full',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer',
              isActive
                ? 'bg-accent text-white shadow-orange-glow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            )}
          >
            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px]',
                  isActive ? 'bg-black/25 text-white' : 'bg-surface-2 text-zinc-400'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
