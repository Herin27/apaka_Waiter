import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, AlertTriangle, Trash2, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Button, Badge, Input, Select, Modal, DataTable } from '../components/ui';

export default function AdminInventoryPage() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newIng, setNewIng] = useState({
    name: '',
    unit: 'kg',
    currentStock: 10,
    lowStockThreshold: 3,
    costPerUnit: 100,
  });

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    type: 'RESTOCK',
    quantity: 5,
    reason: '',
  });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      setIngredients(res.data.data.ingredients || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleCreateIngredient = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', newIng);
      toast.success('Ingredient added');
      setCreateOpen(false);
      setNewIng({ name: '', unit: 'kg', currentStock: 10, lowStockThreshold: 3, costPerUnit: 100 });
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add ingredient');
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustTarget) return;
    try {
      await api.patch(`/inventory/${adjustTarget._id}/adjust`, adjustForm);
      toast.success('Stock updated');
      setAdjustTarget(null);
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock adjustment failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Ingredient removed');
      fetchInventory();
    } catch {
      toast.error('Failed to delete ingredient');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Ingredient',
      render: (row) => (
        <div>
          <p className="font-bold text-white">{row.name}</p>
          <p className="text-[11px] text-zinc-400">Alert threshold: {row.lowStockThreshold} {row.unit}</p>
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'Current Stock',
      render: (row) => {
        const isLow = row.currentStock <= row.lowStockThreshold;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white">
              {row.currentStock} {row.unit}
            </span>
            {isLow ? (
              <Badge tone="red">
                <AlertTriangle className="h-3 w-3" /> Low Stock
              </Badge>
            ) : (
              <Badge tone="green">Healthy</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'movements',
      label: 'Last Movement',
      render: (row) => {
        const last = row.movements?.[row.movements.length - 1];
        if (!last) return <span className="text-zinc-500">—</span>;
        return (
          <span className="text-[11px] text-zinc-300">
            {last.type} ({last.delta > 0 ? `+${last.delta}` : last.delta} {row.unit}){' '}
            {last.reason ? `• ${last.reason}` : ''}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAdjustTarget(row);
              setAdjustForm({ type: 'RESTOCK', quantity: 5, reason: '' });
            }}
          >
            <Sliders className="h-3.5 w-3.5 text-accent" />
            Restock / Wastage
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row._id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Inventory &amp; Stock Control</h1>
            <p className="text-xs text-zinc-400">
              Auto-deducted on order confirmation • Low-stock alerts • Wastage tracking
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Ingredient
        </Button>
      </div>

      <DataTable columns={columns} data={ingredients} loading={loading} />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Raw Ingredient">
        <form onSubmit={handleCreateIngredient} className="space-y-4">
          <Input
            label="Ingredient Name *"
            required
            value={newIng.name}
            onChange={(e) => setNewIng((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Unit"
              value={newIng.unit}
              onChange={(e) => setNewIng((p) => ({ ...p, unit: e.target.value }))}
              options={[
                { value: 'kg', label: 'Kilograms (kg)' },
                { value: 'g', label: 'Grams (g)' },
                { value: 'l', label: 'Liters (l)' },
                { value: 'ml', label: 'Milliliters (ml)' },
                { value: 'pcs', label: 'Pieces (pcs)' },
              ]}
            />
            <Input
              label="Initial Stock"
              type="number"
              step="0.01"
              value={newIng.currentStock}
              onChange={(e) => setNewIng((p) => ({ ...p, currentStock: Number(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Low Stock Alert Threshold"
              type="number"
              step="0.01"
              value={newIng.lowStockThreshold}
              onChange={(e) =>
                setNewIng((p) => ({ ...p, lowStockThreshold: Number(e.target.value) }))
              }
            />
            <Input
              label="Cost per Unit (₹)"
              type="number"
              step="0.01"
              value={newIng.costPerUnit}
              onChange={(e) => setNewIng((p) => ({ ...p, costPerUnit: Number(e.target.value) }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Ingredient
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.name}`}
      >
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <Select
            label="Movement Type"
            value={adjustForm.type}
            onChange={(e) => setAdjustForm((p) => ({ ...p, type: e.target.value }))}
            options={[
              { value: 'RESTOCK', label: 'Restock (+ Add Stock)' },
              { value: 'WASTAGE', label: 'Wastage / Spoilage (- Deduct Stock)' },
              { value: 'ADJUSTMENT', label: 'Manual Audit Adjustment (+/-)' },
            ]}
          />
          <Input
            label={`Quantity (${adjustTarget?.unit || ''}) *`}
            type="number"
            step="0.01"
            required
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
          />
          <Input
            label="Reason / Supplier Note"
            placeholder="e.g. Morning dairy delivery / Expired batch"
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Apply Movement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
