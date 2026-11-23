import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  QrCode,
  Plus,
  Download,
  RefreshCw,
  Edit3,
  Eye,
  Map as MapIcon,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import {
  Button,
  Badge,
  StatusPill,
  Input,
  Select,
  Modal,
  DataTable,
  ConfirmDialog,
} from '../components/ui';

const tableSchema = z.object({
  name: z.string().min(1, 'Table name is required').max(30),
  seats: z.coerce.number().min(1).max(30),
  shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']),
  section: z.string().min(1, 'Section is required'),
  isActive: z.boolean().default(true),
});

export default function AdminTablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);

  const [qrPreview, setQrPreview] = useState(null); // { tableName, qrUrl, qrDataUrl }
  const [rotateTarget, setRotateTarget] = useState(null);
  const [rotating, setRotating] = useState(false);

  const form = useForm({
    resolver: zodResolver(tableSchema),
    defaultValues: { name: '', seats: 4, shape: 'SQUARE', section: 'Main Hall', isActive: true },
  });

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tables');
      setTables(res.data.data.tables || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const openCreate = () => {
    setEditingTable(null);
    form.reset({ name: '', seats: 4, shape: 'SQUARE', section: 'Main Hall', isActive: true });
    setFormModalOpen(true);
  };

  const openEdit = (tbl) => {
    setEditingTable(tbl);
    form.reset({
      name: tbl.name,
      seats: tbl.seats,
      shape: tbl.shape,
      section: tbl.section || 'Main Hall',
      isActive: tbl.isActive !== false,
    });
    setFormModalOpen(true);
  };

  const onSaveTable = async (values) => {
    try {
      if (editingTable) {
        await api.patch(`/tables/${editingTable._id}`, values);
        toast.success(`Updated Table ${values.name}`);
      } else {
        await api.post('/tables', values);
        toast.success(`Created Table ${values.name}`);
      }
      setFormModalOpen(false);
      fetchTables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save table');
    }
  };

  const handlePreviewQr = async (tbl) => {
    try {
      const res = await api.get(`/tables/${tbl._id}/qr?format=json`);
      setQrPreview(res.data.data);
    } catch {
      toast.error('Could not generate QR preview');
    }
  };

  const handleDownloadPng = async (tbl) => {
    try {
      const res = await api.get(`/tables/${tbl._id}/qr`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `table-${tbl.name}-qr.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Failed to download QR PNG');
    }
  };

  const handleDownloadFullSheetPdf = async () => {
    try {
      const res = await api.get('/tables/qr-sheet', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'aapka-waiter-qr-sheet.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded printable QR Sheet PDF');
    } catch {
      toast.error('Failed to download QR sheet PDF');
    }
  };

  const handleConfirmRotate = async () => {
    if (!rotateTarget) return;
    setRotating(true);
    try {
      await api.post(`/tables/${rotateTarget._id}/rotate-qr`);
      toast.success(`Rotated QR token for ${rotateTarget.name}`);
      setRotateTarget(null);
      fetchTables();
    } catch {
      toast.error('Failed to rotate QR token');
    } finally {
      setRotating(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Table',
      render: (row) => (
        <div>
          <span className="text-sm font-extrabold text-white">{row.name}</span>
          <p className="text-[11px] text-zinc-400">
            {row.section} • {row.seats} seats ({row.shape})
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Live Status',
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: 'active',
      label: 'State',
      render: (row) => (
        <Badge tone={row.isActive ? 'green' : 'red'}>
          {row.isActive ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'qr',
      label: 'Customer QR Link',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-400 max-w-[180px] truncate">
            {row.qrToken}
          </span>
          {row.qrUrl && (
            <a
              href={row.qrUrl}
              target="_blank"
              rel="noreferrer"
              title="Open customer link"
              className="text-accent hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'QR & Table Actions',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => handlePreviewQr(row)}>
            <Eye className="h-3.5 w-3.5 text-accent" />
            Preview QR
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleDownloadPng(row)}>
            <Download className="h-3.5 w-3.5" />
            PNG
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setRotateTarget(row)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Rotate
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            <Edit3 className="h-3.5 w-3.5" />
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
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Tables &amp; QR Codes</h1>
            <p className="text-xs text-zinc-400">
              Generate table QR codes, print A4 QR sheets, or arrange tables on the floor map
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/dashboard/admin/floor">
            <Button variant="secondary" size="sm">
              <MapIcon className="h-4 w-4 text-accent" />
              Floor Editor
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={handleDownloadFullSheetPdf}>
            <Download className="h-4 w-4 text-accent" />
            Full QR Sheet PDF
          </Button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Table
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={tables} loading={loading} />

      {/* Add / Edit Table Modal */}
      <Modal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingTable ? `Edit Table ${editingTable.name}` : 'Add New Table'}
      >
        <form onSubmit={form.handleSubmit(onSaveTable)} className="space-y-4">
          <Input
            label="Table Name *"
            placeholder="T7"
            {...form.register('name')}
            error={form.formState.errors.name?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Seats *"
              type="number"
              min={1}
              max={30}
              {...form.register('seats')}
            />
            <Select
              label="Shape"
              {...form.register('shape')}
              options={[
                { value: 'SQUARE', label: 'Square' },
                { value: 'ROUND', label: 'Round' },
                { value: 'RECTANGLE', label: 'Rectangle' },
              ]}
            />
          </div>
          <Input
            label="Section *"
            placeholder="Main Hall / Window / Lounge"
            {...form.register('section')}
          />
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200 cursor-pointer">
            <input type="checkbox" {...form.register('isActive')} className="rounded accent-accent" />
            <span>Table Enabled for QR Ordering</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              Save Table
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Preview Modal */}
      <Modal
        open={Boolean(qrPreview)}
        onClose={() => setQrPreview(null)}
        title={`Table ${qrPreview?.tableName} QR Code`}
        description="Scan with any phone camera to open the live table menu."
        className="max-w-sm text-center"
      >
        {qrPreview && (
          <div className="space-y-4">
            <div className="mx-auto w-56 h-56 rounded-2xl bg-white p-3 shadow-card">
              <img
                src={qrPreview.qrDataUrl}
                alt={`QR ${qrPreview.tableName}`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[11px] font-mono text-zinc-400 break-all">{qrPreview.qrUrl}</p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleDownloadPng({ _id: qrPreview.tableId, name: qrPreview.tableName })}
            >
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onClose={() => setRotateTarget(null)}
        onConfirm={handleConfirmRotate}
        loading={rotating}
        title={`Rotate QR for ${rotateTarget?.name}?`}
        description="Rotating the QR token immediately invalidates previously printed QR codes for this table."
        confirmLabel="Rotate QR Token"
      />
    </div>
  );
}
