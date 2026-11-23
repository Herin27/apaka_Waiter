import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, Save, Upload, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { Button, Card, Input, Skeleton } from '../components/ui';

const BACKEND_ORIGIN = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000').replace(/\/$/, '');

const resolveImg = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${BACKEND_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

const settingsSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name is required'),
  logo: z.string().optional().default(''),
  gstin: z.string().optional().default(''),
  fssai: z.string().optional().default(''),
  currency: z.string().default('INR'),
  branchName: z.string().min(2, 'Branch name is required'),
  address: z.string().optional().default(''),
  openTime: z.string().default('09:00'),
  closeTime: z.string().default('23:00'),
  taxPercent: z.coerce.number().min(0).max(100),
  serviceChargePercent: z.coerce.number().min(0).max(100),
  autoConfirmSeconds: z.coerce.number().min(0),
  receiptFooter: z.string().optional().default(''),
  geofenceEnabled: z.boolean().default(false),
  geofenceLat: z.coerce.number().default(0),
  geofenceLng: z.coerce.number().default(0),
  geofenceRadiusMeters: z.coerce.number().min(10).default(150),
  languages: z.array(z.string()).min(1, 'Select at least one language'),
});

export default function AdminSettingsPage() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      restaurantName: '',
      logo: '',
      gstin: '',
      fssai: '',
      currency: 'INR',
      branchName: '',
      address: '',
      openTime: '09:00',
      closeTime: '23:00',
      taxPercent: 5,
      serviceChargePercent: 0,
      autoConfirmSeconds: 0,
      receiptFooter: '',
      geofenceEnabled: false,
      geofenceLat: 0,
      geofenceLng: 0,
      geofenceRadiusMeters: 150,
      languages: ['en', 'hi', 'gu'],
    },
  });

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/admin/settings');
      const { restaurant, branch } = res.data.data;
      form.reset({
        restaurantName: restaurant.name || '',
        logo: restaurant.logo || '',
        gstin: restaurant.gstin || '',
        fssai: restaurant.fssai || '',
        currency: restaurant.currency || 'INR',
        branchName: branch.name || '',
        address: branch.address || '',
        openTime: branch.openingHours?.open || '09:00',
        closeTime: branch.openingHours?.close || '23:00',
        taxPercent: restaurant.settings?.taxPercent ?? 5,
        serviceChargePercent: restaurant.settings?.serviceChargePercent ?? 0,
        autoConfirmSeconds: restaurant.settings?.autoConfirmSeconds ?? 0,
        receiptFooter: restaurant.settings?.receiptFooter || 'Thank you for dining with us!',
        geofenceEnabled: Boolean(restaurant.settings?.geofence?.enabled),
        geofenceLat: restaurant.settings?.geofence?.lat ?? 0,
        geofenceLng: restaurant.settings?.geofence?.lng ?? 0,
        geofenceRadiusMeters: restaurant.settings?.geofence?.radiusMeters ?? 150,
        languages: restaurant.settings?.languages || ['en', 'hi', 'gu'],
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/menu-items/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      form.setValue('logo', res.data.data.path);
      toast.success('Brand logo uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleLanguage = (code) => {
    const curr = form.watch('languages') || [];
    if (curr.includes(code)) {
      if (curr.length === 1) return;
      form.setValue(
        'languages',
        curr.filter((c) => c !== code)
      );
    } else {
      form.setValue('languages', [...curr, code]);
    }
  };

  const onSave = async (values) => {
    try {
      await api.patch('/admin/settings', {
        restaurantName: values.restaurantName,
        logo: values.logo,
        gstin: values.gstin,
        fssai: values.fssai,
        currency: values.currency,
        branchName: values.branchName,
        address: values.address,
        openingHours: { open: values.openTime, close: values.closeTime },
        taxPercent: values.taxPercent,
        serviceChargePercent: values.serviceChargePercent,
        autoConfirmSeconds: values.autoConfirmSeconds,
        receiptFooter: values.receiptFooter,
        geofence: {
          enabled: values.geofenceEnabled,
          lat: values.geofenceLat,
          lng: values.geofenceLng,
          radiusMeters: values.geofenceRadiusMeters,
        },
        languages: values.languages,
      });
      await fetchMe();
      toast.success('Restaurant & branch settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const logoPreview = resolveImg(form.watch('logo'));
  const enabledLangs = form.watch('languages') || [];

  return (
    <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Restaurant &amp; Branch Settings</h1>
            <p className="text-xs text-zinc-400">
              Configure taxes, GSTIN/FSSAI, auto-confirm timer, geofencing, and languages
            </p>
          </div>
        </div>

        <Button type="submit" variant="primary" size="md" loading={form.formState.isSubmitting}>
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>

      {/* Brand & Compliance */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-accent">
          Brand Identity &amp; Tax Compliance
        </h2>

        <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-3.5 border border-border-subtle">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo"
              className="h-16 w-16 rounded-2xl object-cover border border-border-strong"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-1 text-zinc-500">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 rounded-xl bg-surface-1 hover:bg-surface-3 border border-border-strong px-3.5 py-2 text-xs font-bold text-white cursor-pointer">
              <Upload className="h-3.5 w-3.5 text-accent" />
              {uploadingLogo ? 'Uploading...' : 'Upload Restaurant Logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-zinc-400">Appears on QR menu splash and PDF invoices</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Restaurant Group Name *" {...form.register('restaurantName')} />
          <Input label="Branch Name *" {...form.register('branchName')} />
          <Input label="GSTIN" placeholder="24AAACA1234A1Z5" {...form.register('gstin')} />
          <Input label="FSSAI License No." placeholder="10724001000456" {...form.register('fssai')} />
        </div>

        <Input label="Branch Address" {...form.register('address')} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input label="Opening Time" type="time" {...form.register('openTime')} />
          <Input label="Closing Time" type="time" {...form.register('closeTime')} />
          <Input label="GST / Tax (%)" type="number" step="0.1" {...form.register('taxPercent')} />
          <Input
            label="Service Charge (%)"
            type="number"
            step="0.1"
            {...form.register('serviceChargePercent')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Auto-Confirm Placed Orders (seconds, 0 = manual)"
            type="number"
            min={0}
            {...form.register('autoConfirmSeconds')}
          />
          <Input label="Receipt Footer Message" {...form.register('receiptFooter')} />
        </div>
      </Card>

      {/* Languages & Geofencing */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-accent">
          Customer Menu Languages &amp; Geofencing
        </h2>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-zinc-300">Enabled Menu Languages</span>
          <div className="flex flex-wrap gap-2">
            {[
              { code: 'en', label: 'English (EN)' },
              { code: 'hi', label: 'Hindi (हिंदी)' },
              { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
            ].map((lang) => {
              const active = enabledLangs.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  className={`rounded-xl border px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-accent/20 border-accent text-white'
                      : 'bg-surface-2 border-border-subtle text-zinc-400'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-border-subtle space-y-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
            <input
              type="checkbox"
              {...form.register('geofenceEnabled')}
              className="rounded accent-accent"
            />
            <span>Enforce Table Geofence (Verify customer is physically at restaurant)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="any"
              {...form.register('geofenceLat')}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              {...form.register('geofenceLng')}
            />
            <Input
              label="Radius (meters)"
              type="number"
              min={10}
              {...form.register('geofenceRadiusMeters')}
            />
          </div>
        </div>
      </Card>
    </form>
  );
}
