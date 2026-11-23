import { useCallback, useEffect, useState } from 'react';
import { Award, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Badge, Input, DataTable } from '../components/ui';
import { formatCurrency } from '../utils/formatters';

const TIER_TONES = {
  BRONZE: 'neutral',
  SILVER: 'blue',
  GOLD: 'amber',
  PLATINUM: 'orange',
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await api.get(`/customers${q}`);
      setCustomers(res.data.data.customers || []);
    } catch {
      toast.error('Failed to load loyalty customers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const columns = [
    {
      key: 'customer',
      label: 'Guest',
      render: (row) => (
        <div>
          <p className="font-bold text-white">{row.name || 'Guest'}</p>
          <p className="text-[11px] font-mono text-zinc-400">{row.phone}</p>
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Loyalty Tier',
      render: (row) => <Badge tone={TIER_TONES[row.tier] || 'neutral'}>{row.tier}</Badge>,
    },
    {
      key: 'points',
      label: 'Points Balance',
      render: (row) => <span className="font-extrabold text-accent">{row.points} pts</span>,
    },
    {
      key: 'visits',
      label: 'Visits',
      render: (row) => <span>{row.visitCount}</span>,
    },
    {
      key: 'spent',
      label: 'Lifetime Spend',
      render: (row) => <span className="font-bold text-white">{formatCurrency(row.totalSpent)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Customers &amp; Loyalty Tiers</h1>
            <p className="text-xs text-zinc-400">
              Repeat guest directory, reward points, and tier progression
            </p>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <DataTable columns={columns} data={customers} loading={loading} />
    </div>
  );
}
