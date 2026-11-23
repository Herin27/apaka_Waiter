import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tag, Plus, Edit3, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  DataTable,
  ConfirmDialog,
} from '../components/ui';
import { formatCurrency } from '../utils/formatters';

const couponSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 chars').max(25),
  description: z.string().optional().default(''),
  discountType: z.enum(['PERCENT', 'FLAT']),
  discountValue: z.coerce.number().min(1, 'Discount must be > 0'),
  minOrderAmount: z.coerce.number().min(0).default(0),
  maxDiscountAmount: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const form = useForm({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: '',
      description: '',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderAmount: 300,
      maxDiscountAmount: 150,
      usageLimit: 100,
      isActive: true,
    },
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/coupons');
      setCoupons(res.data.data.coupons || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreate = () => {
    setEditingCoupon(null);
    form.reset({
      code: '',
      description: '',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderAmount: 300,
      maxDiscountAmount: 150,
      usageLimit: 100,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (cp) => {
    setEditingCoupon(cp);
    form.reset({
      code: cp.code,
      description: cp.description || '',
      discountType: cp.discountType,
      discountValue: cp.discountValue,
      minOrderAmount: cp.minOrderAmount || 0,
      maxDiscountAmount: cp.maxDiscountAmount || 0,
      usageLimit: cp.usageLimit || 0,
      isActive: Boolean(cp.isActive),
    });
    setModalOpen(true);
  };

  const onSaveCoupon = async (values) => {
    try {
      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
        maxDiscountAmount: values.maxDiscountAmount > 0 ? values.maxDiscountAmount : null,
        usageLimit: values.usageLimit > 0 ? values.usageLimit : null,
      };
      if (editingCoupon) {
        await api.patch(`/coupons/${editingCoupon._id}`, payload);
        toast.success('Coupon updated');
      } else {
        await api.post('/coupons', payload);
        toast.success('Coupon created');
      }
      setModalOpen(false);
      fetchCoupons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save coupon');
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await api.patch(`/coupons/${deactivateTarget._id}`, { isActive: false });
      toast.success(`Coupon ${deactivateTarget.code} deactivated`);
      setDeactivateTarget(null);
      fetchCoupons();
    } catch {
      toast.error('Failed to deactivate coupon');
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row) => (
        <div>
          <span className="font-mono text-sm font-extrabold text-accent">{row.code}</span>
          {row.description && <p className="text-[11px] text-zinc-400">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (row) => (
        <span className="font-bold text-white">
          {row.discountType === 'PERCENT'
            ? `${row.discountValue}% OFF`
            : `${formatCurrency(row.discountValue)} FLAT`}
          {row.maxDiscountAmount ? ` (up to ${formatCurrency(row.maxDiscountAmount)})` : ''}
        </span>
      ),
    },
    {
      key: 'minOrder',
      label: 'Min Order',
      render: (row) => <span>{formatCurrency(row.minOrderAmount || 0)}</span>,
    },
    {
      key: 'usage',
      label: 'Usage',
      render: (row) => (
        <span>
          {row.usedCount || 0} / {row.usageLimit ?? '∞'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'green' : 'red'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          {row.isActive && (
            <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(row)}>
              <PowerOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Promo Codes &amp; Coupons</h1>
            <p className="text-xs text-zinc-400">
              Create percentage or flat discounts redeemable by customers and cashiers
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      <DataTable columns={columns} data={coupons} loading={loading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCoupon ? `Edit Coupon ${editingCoupon.code}` : 'Create Promo Coupon'}
      >
        <form onSubmit={form.handleSubmit(onSaveCoupon)} className="space-y-4">
          <Input
            label="Coupon Code *"
            placeholder="FESTIVE20"
            {...form.register('code')}
            error={form.formState.errors.code?.message}
          />
          <Input
            label="Description"
            placeholder="20% off on weekend orders"
            {...form.register('description')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Discount Type"
              {...form.register('discountType')}
              options={[
                { value: 'PERCENT', label: 'Percentage (%)' },
                { value: 'FLAT', label: 'Flat Amount (₹)' },
              ]}
            />
            <Input
              label="Discount Value *"
              type="number"
              min={1}
              {...form.register('discountValue')}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Min Order (₹)" type="number" min={0} {...form.register('minOrderAmount')} />
            <Input
              label="Max Discount (₹)"
              type="number"
              min={0}
              {...form.register('maxDiscountAmount')}
            />
            <Input label="Usage Limit" type="number" min={0} {...form.register('usageLimit')} />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200 cursor-pointer">
            <input type="checkbox" {...form.register('isActive')} className="rounded accent-accent" />
            <span>Coupon Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              Save Coupon
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleConfirmDeactivate}
        title={`Deactivate ${deactivateTarget?.code}?`}
        description="Customers and cashiers will no longer be able to apply this promo code."
        confirmLabel="Deactivate"
      />
    </div>
  );
}
