import { Flame, Clock, Plus, Sparkles } from 'lucide-react';
import { formatCurrency, getLocalizedText } from '../../utils/formatters';
import { cn } from '../../utils/cn';

const BACKEND_ORIGIN = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000').replace(/\/$/, '');

const resolveImageUrl = (img) => {
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) return img;
  return `${BACKEND_ORIGIN}${img.startsWith('/') ? '' : '/'}${img}`;
};

export default function MenuItemCard({ item, language = 'en', currency = 'INR', onSelect }) {
  const name = getLocalizedText(item.name, language);
  const description = getLocalizedText(item.description, language);
  const imageUrl = resolveImageUrl(item.image);
  const available = item.isAvailable !== false;

  return (
    <div
      onClick={() => available && onSelect(item)}
      className={cn(
        'group relative flex gap-3.5 rounded-2xl border p-3.5 transition-all',
        available
          ? 'bg-surface-1 border-border-subtle hover:border-accent/45 hover:bg-surface-2/80 cursor-pointer active:scale-[0.99]'
          : 'bg-surface-1/45 border-border-subtle opacity-55 grayscale cursor-not-allowed'
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span
              title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-[4px] border',
                item.isVeg ? 'border-emerald-500' : 'border-red-500'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                )}
              />
            </span>

            {item.isBestseller && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 border border-accent/35 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                <Sparkles className="h-2.5 w-2.5" />
                Bestseller
              </span>
            )}

            {item.isJain && (
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                Jain
              </span>
            )}

            {item.isVegan && (
              <span className="rounded-md bg-teal-500/10 border border-teal-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-teal-300">
                Vegan
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-white leading-snug group-hover:text-accent transition-colors">
            {name}
          </h3>

          {description && (
            <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-extrabold text-white">
              {formatCurrency(item.price, currency)}
            </span>

            {item.spiceLevel > 0 && (
              <span
                className="inline-flex items-center text-red-400"
                title={`Spice level ${item.spiceLevel}/3`}
              >
                {Array.from({ length: item.spiceLevel }).map((_, i) => (
                  <Flame key={i} className="h-3 w-3 fill-red-500 text-red-500" />
                ))}
              </span>
            )}

            {item.prepTimeMin && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                <Clock className="h-3 w-3" />
                {item.prepTimeMin}m
              </span>
            )}
          </div>

          {!available && (
            <span className="rounded-lg bg-zinc-800 border border-border-strong px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-300">
              Unavailable
            </span>
          )}
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-between shrink-0 w-24">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="h-24 w-24 rounded-xl object-cover border border-border-subtle"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-surface-2 border border-border-subtle text-center px-2">
            <span className="text-[10px] font-semibold text-zinc-500 line-clamp-2">{name}</span>
          </div>
        )}

        {available && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className="-mt-3 inline-flex items-center gap-1 rounded-xl bg-surface-2 hover:bg-accent text-accent hover:text-white border border-accent/50 px-3 py-1 text-xs font-bold shadow-card transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            ADD
          </button>
        )}
      </div>
    </div>
  );
}
