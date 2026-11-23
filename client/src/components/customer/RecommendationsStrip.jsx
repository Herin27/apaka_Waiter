import { useEffect, useState } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, getLocalizedText } from '../../utils/formatters';

export default function RecommendationsStrip({
  title = 'People also ordered',
  itemId = null,
  cartItemIds = [],
  mode = 'alsoOrdered', // 'alsoOrdered' | 'goesWellWith' | 'cartUpsells'
  language = 'en',
  currency = 'INR',
  dismissible = false,
  onQuickAdd,
}) {
  const [recs, setRecs] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', itemId);
    if (cartItemIds.length) params.set('cartItemIds', cartItemIds.join(','));

    api
      .get(`/public/ai/recommendations?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        const list = res.data?.data?.[mode] || [];
        setRecs(list);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [itemId, cartItemIds.join(','), mode]);

  if (dismissed || !recs.length) return null;

  return (
    <div className="rounded-2xl bg-surface-2/80 border border-border-subtle p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          {title}
        </span>
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss suggestions"
            className="text-zinc-500 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {recs.map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between gap-2.5 rounded-xl bg-surface-1 border border-border-subtle px-3 py-2 shrink-0 min-w-[180px]"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {getLocalizedText(item.name, language)}
              </p>
              <p className="text-[11px] font-semibold text-zinc-400">
                {formatCurrency(item.price, currency)}
              </p>
            </div>

            {onQuickAdd && (
              <button
                type="button"
                onClick={() => onQuickAdd(item)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 hover:bg-accent text-accent hover:text-white border border-accent/40 transition cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
