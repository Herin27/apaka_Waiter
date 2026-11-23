import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, ShieldCheck, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Button, Card, Badge, Input, Modal, DataTable } from '../components/ui';

export default function SuperAdminPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    restaurantName: '',
    branchName: '',
    gstin: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/super/restaurants');
      setRestaurants(res.data.data.restaurants || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/super/restaurants', form);
      toast.success(`Created restaurant "${form.restaurantName}" & admin account`);
      setCreateOpen(false);
      setForm({
        restaurantName: '',
        branchName: '',
        gstin: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
      });
      fetchRestaurants();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create restaurant');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (rest) => {
    try {
      const nextStatus = !rest.isActive;
      await api.patch(`/super/restaurants/${rest._id}/toggle-status`, { isActive: nextStatus });
      toast.success(`${rest.name} ${nextStatus ? 'activated' : 'suspended'}`);
      fetchRestaurants();
    } catch {
      toast.error('Failed to toggle restaurant status');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Restaurant',
      render: (row) => (
        <div>
          <p className="font-bold text-white">{row.name}</p>
          <p className="text-[11px] text-zinc-400">
            {row.branchesCount} branch(es) {row.gstin ? `• GSTIN: ${row.gstin}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'admin',
      label: 'Primary Admin',
      render: (row) => {
        const adm = row.admins?.[0];
        return adm ? (
          <div>
            <p className="text-xs font-semibold text-zinc-200">{adm.name}</p>
            <p className="text-[11px] text-zinc-400">{adm.email}</p>
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        );
      },
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row) => <Badge tone="orange">{row.plan || 'GROWTH'}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'green' : 'red'}>
          {row.isActive ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <Button
          size="sm"
          variant={row.isActive ? 'danger' : 'success'}
          onClick={() => handleToggleStatus(row)}
        >
          {row.isActive ? (
            <>
              <PowerOff className="h-3.5 w-3.5" />
              Suspend
            </>
          ) : (
            <>
              <Power className="h-3.5 w-3.5" />
              Activate
            </>
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Card glow className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Superadmin Platform Control</h1>
            <p className="text-xs text-zinc-400">
              Provision new restaurants, create branch admins, and suspend/activate tenants
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Restaurant
        </Button>
      </Card>

      <DataTable columns={columns} data={restaurants} loading={loading} />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Provision Restaurant & First Admin"
      >
        <form onSubmit={handleCreate} className="space-y-3.5">
          <Input
            label="Restaurant Name *"
            required
            value={form.restaurantName}
            onChange={(e) => setForm((p) => ({ ...p, restaurantName: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Primary Branch Name"
              placeholder="Main Outlet"
              value={form.branchName}
              onChange={(e) => setForm((p) => ({ ...p, branchName: e.target.value }))}
            />
            <Input
              label="GSTIN"
              value={form.gstin}
              onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value }))}
            />
          </div>
          <Input
            label="First Admin Name *"
            required
            value={form.adminName}
            onChange={(e) => setForm((p) => ({ ...p, adminName: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Admin Email *"
              type="email"
              required
              value={form.adminEmail}
              onChange={(e) => setForm((p) => ({ ...p, adminEmail: e.target.value }))}
            />
            <Input
              label="Admin Password *"
              type="password"
              minLength={8}
              required
              value={form.adminPassword}
              onChange={(e) => setForm((p) => ({ ...p, adminPassword: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Create Restaurant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
