import { useCallback, useEffect, useState } from 'react';
import { History, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Button, Badge, Input, Select, DataTable } from '../components/ui';

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchLogs = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: '25',
        });
        if (actionFilter.trim()) params.set('action', actionFilter.trim());
        if (roleFilter) params.set('actorRole', roleFilter);

        const res = await api.get(`/admin/activity-logs?${params.toString()}`);
        setLogs(res.data.data.logs || []);
        setPagination(res.data.data.pagination || { page: 1, pages: 1, total: 0 });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load activity logs');
      } finally {
        setLoading(false);
      }
    },
    [page, actionFilter, roleFilter]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const columns = [
    {
      key: 'time',
      label: 'Timestamp',
      render: (row) => (
        <span className="font-mono text-[11px] text-zinc-400">
          {new Date(row.createdAt).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (row) => (
        <div>
          <p className="font-bold text-white">{row.userId?.name || 'System'}</p>
          <Badge tone="neutral" className="uppercase text-[10px]">
            {row.actorRole}
          </Badge>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => <Badge tone="orange">{row.action}</Badge>,
    },
    {
      key: 'entity',
      label: 'Target Entity',
      render: (row) => (
        <span className="text-zinc-300 font-semibold">
          {row.entityType} {row.entityId ? `#${String(row.entityId).slice(-6)}` : ''}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      render: (row) => (
        <span className="font-mono text-[11px] text-zinc-400 break-all">
          {JSON.stringify(row.details || {})}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Audit &amp; Activity Logs</h1>
            <p className="text-xs text-zinc-400">
              Immutable trail of logins, order changes, refunds, staff updates, and settings
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={() => fetchLogs(page)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder="Filter by action (e.g. REFUND, LOGIN)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-44">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'waiter', label: 'Waiter' },
              { value: 'kitchen', label: 'Kitchen' },
              { value: 'cashier', label: 'Cashier' },
              { value: 'SYSTEM', label: 'System' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onPageChange={setPage}
      />
    </div>
  );
}
