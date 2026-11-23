import { Flame, RotateCcw } from 'lucide-react';
import { Drawer, Button } from '../ui';
import { cn } from '../../utils/cn';

const COMMON_ALLERGENS = ['Dairy', 'Gluten', 'Tree Nuts', 'Peanuts', 'Soy', 'Egg', 'Sesame', 'Fish', 'Mustard'];

export default function FilterDrawer({ open, onClose, filters, setFilters, onReset }) {
  const toggleDiet = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllergen = (allergen) => {
    setFilters((prev) => {
      const exists = prev.excludeAllergens.includes(allergen);
      return {
        ...prev,
        excludeAllergens: exists
          ? prev.excludeAllergens.filter((a) => a !== allergen)
          : [...prev.excludeAllergens, allergen],
      };
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Dietary & Spice Filters"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="flex-1" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset All
          </Button>
          <Button variant="primary" className="flex-1" onClick={onClose}>
            Apply Filters
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Dietary Preferences
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'isVeg', label: 'Pure Veg' },
              { key: 'isVegan', label: 'Vegan' },
              { key: 'isJain', label: 'Jain' },
            ].map((opt) => {
              const active = filters[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleDiet(opt.key)}
                  className={cn(
                    'rounded-xl border py-2.5 px-3 text-xs font-bold transition cursor-pointer',
                    active
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-surface-2 border-border-subtle text-zinc-300 hover:border-border-strong'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Spice Level
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: null, label: 'Any' },
              { value: 0, label: 'Mild (0)' },
              { value: 1, label: 'Medium (1)' },
              { value: 2, label: 'Spicy (2+)' },
            ].map((sp) => {
              const active = filters.spiceLevel === sp.value;
              return (
                <button
                  key={String(sp.value)}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, spiceLevel: sp.value }))}
                  className={cn(
                    'inline-flex items-center justify-center gap-1 rounded-xl border py-2.5 px-2 text-xs font-semibold transition cursor-pointer',
                    active
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-2 border-border-subtle text-zinc-300'
                  )}
                >
                  {sp.value !== null && sp.value > 0 && <Flame className="h-3 w-3" />}
                  {sp.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Exclude Allergens
          </h4>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map((allergen) => {
              const excluded = filters.excludeAllergens.includes(allergen);
              return (
                <button
                  key={allergen}
                  type="button"
                  onClick={() => toggleAllergen(allergen)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                    excluded
                      ? 'bg-red-500/15 border-red-500/50 text-red-300'
                      : 'bg-surface-2 border-border-subtle text-zinc-300 hover:border-border-strong'
                  )}
                >
                  {excluded ? `No ${allergen}` : allergen}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
