import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users,
  UserPlus,
  Edit3,
  KeyRound,
  UserCheck,
  UserX,
} from 'lucide-react';
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

const createStaffFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().default(''),
  password: z.string().min(8, 'Minimum 8 characters'),
  role: z.enum(['admin', 'waiter', 'kitchen', 'cashier']),
  assignedTables: z.array(z.string()).default([]),
});

const editStaffFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().optional().default(''),
  role: z.enum(['admin', 'waiter', 'kitchen', 'cashier']),
  assignedTables: z.array(z.string()).default([]),
});

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [resetPwdMember, setResetPwdMember] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [toggleActiveTarget, setToggleActiveTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const createForm = useForm({
    resolver: zodResolver(createStaffFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'waiter',
      assignedTables: [],
    },
  });

  const editForm = useForm({
    resolver: zodResolver(editStaffFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      role: 'waiter',
      assignedTables: [],
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, tablesRes] = await Promise.all([api.get('/staff'), api.get('/tables')]);
      setStaff(staffRes.data.data.staff || []);
      setTables(tablesRes.data.data.tables || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onCreateStaff = async (values) => {
    try {
      await api.post('/staff', values);
      toast.success(`Invited ${values.name} (${values.role})`);
      setCreateModalOpen(false);
      createForm.reset();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff member');
    }
  };

  const openEdit = (member) => {
    setEditingMember(member);
    editForm.reset({
      name: member.name,
      phone: member.phone || '',
      role: member.role === 'superadmin' ? 'admin' : member.role,
      assignedTables: (member.assignedTables || []).map((t) => t._id || t),
    });
  };

  const onEditStaff = async (values) => {
    if (!editingMember) return;
    try {
      await api.patch(`/staff/${editingMember.id}`, values);
      toast.success('Staff member updated');
      setEditingMember(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update staff');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPwdMember || newPassword.length < 8) return;
    setBusy(true);
    try {
      await api.patch(`/staff/${resetPwdMember.id}`, { password: newPassword });
      toast.success(`Password reset for ${resetPwdMember.name}`);
      setResetPwdMember(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!toggleActiveTarget) return;
    setBusy(true);
    try {
      if (toggleActiveTarget.isActive) {
        await api.delete(`/staff/${toggleActiveTarget.id}`);
        toast.success(`${toggleActiveTarget.name} deactivated`);
      } else {
        await api.patch(`/staff/${toggleActiveTarget.id}`, { isActive: true });
        toast.success(`${toggleActiveTarget.name} activated`);
      }
      setToggleActiveTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'member',
      label: 'Staff Member',
      render: (row) => (
        <div>
          <p className="font-bold text-white">{row.name}</p>
          <p className="text-[11px] text-zinc-400">
            {row.email} {row.phone ? `• ${row.phone}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <Badge tone="orange" className="uppercase">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'tables',
      label: 'Assigned Tables',
      render: (row) =>
        row.assignedTables?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.assignedTables.map((t) => (
              <Badge key={t._id || t} tone="neutral">
                {t.name || t}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-zinc-500">All Tables</span>
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
          <Button
            size="sm"
            variant="secondary"
            title="Reset Password"
            onClick={() => {
              setResetPwdMember(row);
              setNewPassword('');
            }}
          >
            <KeyRound className="h-3.5 w-3.5 text-accent" />
          </Button>
          <Button
            size="sm"
            variant={row.isActive ? 'danger' : 'success'}
            title={row.isActive ? 'Deactivate' : 'Activate'}
            onClick={() => setToggleActiveTarget(row)}
          >
            {row.isActive ? (
              <UserX className="h-3.5 w-3.5" />
            ) : (
              <UserCheck className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  const renderTableMultiSelect = (formInstance) => {
    const selected = formInstance.watch('assignedTables') || [];
    const toggleTable = (id) => {
      const next = selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id];
      formInstance.setValue('assignedTables', next);
    };

    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-300">
          Assigned Tables (Leave empty for all tables)
        </label>
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-surface-2 p-2.5 border border-border-subtle">
          {tables.map((t) => {
            const active = selected.includes(t._id);
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => toggleTable(t._id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-accent text-white'
                    : 'bg-surface-1 text-zinc-400 hover:text-white'
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Staff &amp; Role Management</h1>
            <p className="text-xs text-zinc-400">
              Manage branch admins, waiters, kitchen chefs, and cashiers
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite Staff
        </Button>
      </div>

      <DataTable columns={columns} data={staff} loading={loading} />

      {/* Invite / Create Staff Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Invite New Staff Member"
      >
        <form onSubmit={createForm.handleSubmit(onCreateStaff)} className="space-y-4">
          <Input
            label="Full Name *"
            {...createForm.register('name')}
            error={createForm.formState.errors.name?.message}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email *"
              type="email"
              {...createForm.register('email')}
              error={createForm.formState.errors.email?.message}
            />
            <Input label="Phone" {...createForm.register('phone')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Initial Password (min 8 chars) *"
              type="password"
              {...createForm.register('password')}
              error={createForm.formState.errors.password?.message}
            />
            <Select
              label="Role *"
              {...createForm.register('role')}
              options={[
                { value: 'waiter', label: 'Waiter' },
                { value: 'kitchen', label: 'Kitchen' },
                { value: 'cashier', label: 'Cashier' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>

          {renderTableMultiSelect(createForm)}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createForm.formState.isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        open={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        title={`Edit ${editingMember?.name}`}
      >
        <form onSubmit={editForm.handleSubmit(onEditStaff)} className="space-y-4">
          <Input label="Full Name *" {...editForm.register('name')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" {...editForm.register('phone')} />
            <Select
              label="Role"
              {...editForm.register('role')}
              options={[
                { value: 'waiter', label: 'Waiter' },
                { value: 'kitchen', label: 'Kitchen' },
                { value: 'cashier', label: 'Cashier' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          {renderTableMultiSelect(editForm)}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editForm.formState.isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={Boolean(resetPwdMember)}
        onClose={() => setResetPwdMember(null)}
        title={`Reset Password — ${resetPwdMember?.name}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="New Password (minimum 8 characters) *"
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setResetPwdMember(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleActiveTarget)}
        onClose={() => setToggleActiveTarget(null)}
        onConfirm={handleConfirmToggleActive}
        loading={busy}
        variant={toggleActiveTarget?.isActive ? 'danger' : 'success'}
        title={`${toggleActiveTarget?.isActive ? 'Deactivate' : 'Activate'} ${
          toggleActiveTarget?.name
        }?`}
        description={
          toggleActiveTarget?.isActive
            ? 'This staff member will immediately lose access to all dashboards.'
            : 'Restore dashboard login access for this staff member.'
        }
        confirmLabel={toggleActiveTarget?.isActive ? 'Deactivate' : 'Activate'}
      />
    </div>
  );
}
