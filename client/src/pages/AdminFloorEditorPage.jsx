import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  QrCode,
  RefreshCw,
  Grid,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import {
  Button,
  Card,
  Input,
  Select,
  Modal,
  Badge,
  Skeleton,
} from '../components/ui';
import FloorMap, { normalizeTableCoords } from '../components/floor/FloorMap';

export default function AdminFloorEditorPage() {
  const [loading, setLoading] = useState(true);
  const [savingLayout, setSavingLayout] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);

  // Add Table Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTable, setNewTable] = useState({
    name: '',
    seats: 4,
    shape: 'SQUARE',
    section: 'Main Hall',
  });
  const [creating, setCreating] = useState(false);

  // Inspector draft fields for selected table
  const [inspector, setInspector] = useState({
    name: '',
    seats: 4,
    shape: 'SQUARE',
    section: 'Main Hall',
  });
  const [updatingProps, setUpdatingProps] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get('/tables');
      const fetched = (res.data.data.tables || []).map((t, idx) => {
        const { xPct, yPct } = normalizeTableCoords(t, idx);
        return { ...t, x: xPct, y: yPct };
      });
      setTables(fetched);
      setHasUnsavedLayout(false);
      if (fetched.length > 0 && !selectedId) {
        setSelectedId(fetched[0]._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load floor tables');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const selectedTable = tables.find((t) => t._id === selectedId) || null;

  useEffect(() => {
    if (selectedTable) {
      setInspector({
        name: selectedTable.name || '',
        seats: selectedTable.seats || 4,
        shape: selectedTable.shape || 'SQUARE',
        section: selectedTable.section || 'Main Hall',
      });
    }
  }, [selectedTable]);

  // Drag handler from FloorMap (snapped to 4% grid)
  const handleMoveTable = useCallback((tableId, xPct, yPct) => {
    setTables((prev) =>
      prev.map((t) => (t._id === tableId ? { ...t, x: xPct, y: yPct } : t))
    );
    setHasUnsavedLayout(true);
  }, []);

  // Save all x, y, shape positions via PATCH /api/v1/tables/layout
  const handleSaveLayout = async () => {
    if (tables.length === 0) return;
    setSavingLayout(true);
    try {
      await api.patch('/tables/layout', {
        tables: tables.map((t) => ({
          id: t._id,
          x: Number(t.x),
          y: Number(t.y),
          shape: t.shape,
        })),
      });
      setHasUnsavedLayout(false);
      toast.success('Floor map layout saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save floor layout');
    } finally {
      setSavingLayout(false);
    }
  };

  // Add new table
  const handleCreateTable = async (e) => {
    e.preventDefault();
    if (!newTable.name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/tables', {
        name: newTable.name.trim(),
        seats: Number(newTable.seats),
        shape: newTable.shape,
        section: newTable.section.trim() || 'Main Hall',
        x: 50,
        y: 52,
      });
      const created = res.data.data.table;
      setTables((prev) => [...prev, created]);
      setSelectedId(created._id);
      setNewTable({ name: '', seats: 4, shape: 'SQUARE', section: 'Main Hall' });
      setAddModalOpen(false);
      toast.success(`Table ${created.name} added to floor`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create table');
    } finally {
      setCreating(false);
    }
  };

  // Update selected table properties (name, seats, shape, section)
  const handleUpdateTableProperties = async (e) => {
    e.preventDefault();
    if (!selectedTable) return;
    setUpdatingProps(true);
    try {
      const res = await api.patch(`/tables/${selectedTable._id}`, {
        name: inspector.name.trim(),
        seats: Number(inspector.seats),
        shape: inspector.shape,
        section: inspector.section.trim() || 'Main Hall',
      });
      const updated = res.data.data.table;
      setTables((prev) =>
        prev.map((t) =>
          t._id === selectedTable._id
            ? { ...t, ...updated, x: t.x, y: t.y }
            : t
        )
      );
      toast.success(`Updated Table ${updated.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update table');
    } finally {
      setUpdatingProps(false);
    }
  };

  // Delete selected table
  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    if (!window.confirm(`Delete Table ${selectedTable.name}? This cannot be undone.`)) return;

    try {
      await api.delete(`/tables/${selectedTable._id}`);
      setTables((prev) => prev.filter((t) => t._id !== selectedTable._id));
      setSelectedId(null);
      toast.success(`Table ${selectedTable.name} deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete table');
    }
  };

  const handleRotateQr = async () => {
    if (!selectedTable) return;
    try {
      const res = await api.post(`/tables/${selectedTable._id}/rotate-qr`);
      const updated = res.data.data.table;
      setTables((prev) =>
        prev.map((t) => (t._id === selectedTable._id ? { ...t, ...updated, x: t.x, y: t.y } : t))
      );
      toast.success(`Rotated QR token for ${updated.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rotate QR');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[460px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/35 text-accent">
            <Grid className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white">Floor Plan Editor</h1>
              {hasUnsavedLayout && <Badge tone="amber">Unsaved Positions</Badge>}
            </div>
            <p className="text-xs text-zinc-400">
              Drag tables onto the grid (snaps automatically) and click Save Layout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 text-accent" />
            Add Table
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={savingLayout}
            onClick={handleSaveLayout}
          >
            <Save className="h-4 w-4" />
            Save Layout
          </Button>
        </div>
      </div>

      {/* Main Editor Grid: Interactive Map + Selected Table Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8">
          <FloorMap
            tables={tables}
            editable
            selectedTableId={selectedId}
            onSelectTable={(t) => setSelectedId(t._id)}
            onMoveTable={handleMoveTable}
            enableSocket={false}
          />
        </div>

        <div className="xl:col-span-4">
          <Card glow={Boolean(selectedTable)} className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-white">Table Inspector</h2>
                <p className="text-xs text-zinc-400">
                  {selectedTable
                    ? `Editing ${selectedTable.name} (${selectedTable.x}%, ${selectedTable.y}%)`
                    : 'Click any table on the map to edit'}
                </p>
              </div>
              {selectedTable && (
                <Badge tone="orange">
                  <CheckCircle2 className="h-3 w-3" /> Selected
                </Badge>
              )}
            </div>

            {!selectedTable ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                Select a table node on the floor canvas to customize its shape, seats, or QR token.
              </p>
            ) : (
              <form onSubmit={handleUpdateTableProperties} className="space-y-3.5">
                <Input
                  label="Table Name"
                  value={inspector.name}
                  onChange={(e) => setInspector((p) => ({ ...p, name: e.target.value }))}
                  placeholder="T1"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Seats"
                    type="number"
                    min={1}
                    max={20}
                    value={inspector.seats}
                    onChange={(e) => setInspector((p) => ({ ...p, seats: e.target.value }))}
                    required
                  />

                  <Select
                    label="Shape"
                    value={inspector.shape}
                    onChange={(e) => setInspector((p) => ({ ...p, shape: e.target.value }))}
                    options={[
                      { value: 'SQUARE', label: 'Square' },
                      { value: 'ROUND', label: 'Round' },
                      { value: 'RECTANGLE', label: 'Rectangle' },
                    ]}
                  />
                </div>

                <Input
                  label="Section / Zone"
                  value={inspector.section}
                  onChange={(e) => setInspector((p) => ({ ...p, section: e.target.value }))}
                  placeholder="Window / Main Hall / Lounge"
                />

                {selectedTable.qrUrl && (
                  <div className="rounded-xl bg-surface-2 border border-border-subtle p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-300">
                        <QrCode className="h-3.5 w-3.5 text-accent" />
                        Active QR Link
                      </span>
                      <button
                        type="button"
                        onClick={handleRotateQr}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Rotate QR
                      </button>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400 break-all">
                      {selectedTable.qrUrl}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={updatingProps}
                    className="flex-1"
                  >
                    Update Table
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    onClick={handleDeleteTable}
                    title="Delete Table"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>

      {/* Add Table Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Table"
        description="Creates a new table with a unique signed QR token."
      >
        <form onSubmit={handleCreateTable} className="space-y-4">
          <Input
            label="Table Name *"
            placeholder="e.g. T7 or VIP-1"
            value={newTable.name}
            onChange={(e) => setNewTable((p) => ({ ...p, name: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Seats"
              type="number"
              min={1}
              max={20}
              value={newTable.seats}
              onChange={(e) => setNewTable((p) => ({ ...p, seats: e.target.value }))}
              required
            />

            <Select
              label="Shape"
              value={newTable.shape}
              onChange={(e) => setNewTable((p) => ({ ...p, shape: e.target.value }))}
              options={[
                { value: 'SQUARE', label: 'Square' },
                { value: 'ROUND', label: 'Round' },
                { value: 'RECTANGLE', label: 'Rectangle' },
              ]}
            />
          </div>

          <Input
            label="Section"
            placeholder="Main Hall / Patio / Lounge"
            value={newTable.section}
            onChange={(e) => setNewTable((p) => ({ ...p, section: e.target.value }))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Create Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
