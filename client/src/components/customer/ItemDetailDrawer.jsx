import { useEffect, useMemo, useState } from 'react';
import { Flame, Clock, Minus, Plus, Check, AlertTriangle } from 'lucide-react';
import { Drawer, Button, Badge } from '../ui';
import { formatCurrency, getLocalizedText } from '../../utils/formatters';
import { cn } from '../../utils/cn';

const BACKEND_ORIGIN = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000').replace(/\/$/, '');

const resolveImageUrl = (img) => {
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) return img;
  return `${BACKEND_ORIGIN}${img.startsWith('/') ? '' : '/'}${img}`;
};

export default function ItemDetailDrawer({
  item,
  open,
  onClose,
  language = 'en',
  currency = 'INR',
  onAddToCart,
  submitting = false,
}) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (item) {
      setSelectedVariant(item.variants?.length > 0 ? item.variants[0] : null);
      setSelectedAddons([]);
      setNote('');
      setQty(1);
    }
  }, [item]);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    const base = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
    const addonsSum = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
    return base + addonsSum;
  }, [item, selectedVariant, selectedAddons]);

  const totalPrice = unitPrice * qty;

  if (!item) return null;

  const name = getLocalizedText(item.name, language);
  const description = getLocalizedText(item.description, language);
  const imageUrl = resolveImageUrl(item.image);

  const toggleAddon = (addon) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.name === addon.name);
      if (exists) return prev.filter((a) => a.name !== addon.name);
      return [...prev, addon];
    });
  };

  const handleConfirm = () => {
    onAddToCart({
      menuItemId: item._id,
      qty,
      ...(selectedVariant ? { variantName: selectedVariant.name } : {}),
      addonNames: selectedAddons.map((a) => a.name),
      note: note.trim(),
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={name}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-surface-1 border border-border-strong p-1">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-extrabold text-white">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(50, q + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <Button
            size="lg"
            loading={submitting}
            onClick={handleConfirm}
            className="flex-1 justify-between px-5"
          >
            <span>Add to cart</span>
            <span className="font-extrabold">{formatCurrency(totalPrice, currency)}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            className="h-48 w-full rounded-2xl object-cover border border-border-subtle"
          />
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.isVeg ? 'green' : 'red'}>
              {item.isVeg ? 'Pure Veg' : 'Non-Veg'}
            </Badge>
            {item.isJain && <Badge tone="green">Jain</Badge>}
            {item.isVegan && <Badge tone="blue">Vegan</Badge>}
            {item.spiceLevel > 0 && (
              <Badge tone="amber">
                <Flame className="h-3 w-3" /> Spice {item.spiceLevel}/3
              </Badge>
            )}
            {item.prepTimeMin && (
              <Badge tone="neutral">
                <Clock className="h-3 w-3" /> ~{item.prepTimeMin} mins
              </Badge>
            )}
          </div>

          {description && <p className="text-sm text-zinc-300 leading-relaxed">{description}</p>}

          {item.allergens?.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Contains: {item.allergens.join(', ')}</span>
            </div>
          )}
        </div>

        {item.variants?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Choose Size / Variant
              </h4>
              <span className="text-[11px] text-accent font-semibold">Required</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {item.variants.map((variant) => {
                const isSelected = selectedVariant?.name === variant.name;
                return (
                  <button
                    key={variant.name}
                    type="button"
                    onClick={() => setSelectedVariant(variant)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-3 text-left transition cursor-pointer',
                      isSelected
                        ? 'bg-accent/15 border-accent text-white'
                        : 'bg-surface-2 border-border-subtle text-zinc-300 hover:border-border-strong'
                    )}
                  >
                    <span className="text-sm font-semibold">{variant.name}</span>
                    <span className="text-sm font-bold text-white">
                      {formatCurrency(variant.price, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {item.addons?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Optional Add-ons
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {item.addons.map((addon) => {
                const isChecked = selectedAddons.some((a) => a.name === addon.name);
                return (
                  <button
                    key={addon.name}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-3 text-left transition cursor-pointer',
                      isChecked
                        ? 'bg-accent/15 border-accent text-white'
                        : 'bg-surface-2 border-border-subtle text-zinc-300 hover:border-border-strong'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md border',
                          isChecked
                            ? 'bg-accent border-accent text-white'
                            : 'border-zinc-600 bg-surface-1'
                        )}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-sm font-medium">{addon.name}</span>
                    </div>
                    <span className="text-xs font-bold text-zinc-200">
                      +{formatCurrency(addon.price, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Kitchen Instructions (Optional)
          </label>
          <textarea
            rows={2}
            maxLength={250}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="E.g. Less spicy, no onions, extra crispy..."
            className="w-full rounded-xl bg-surface-2 border border-border-subtle p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
          />
        </div>
      </div>
    </Drawer>
  );
}
