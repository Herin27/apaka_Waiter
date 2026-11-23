import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Upload,
  Download,
  GripVertical,
  Image as ImageIcon,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  Modal,
  DataTable,
  ConfirmDialog,
} from '../components/ui';
import { formatCurrency } from '../utils/formatters';
import { cn } from '../utils/cn';

const BACKEND_ORIGIN = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000').replace(/\/$/, '');

const resolveImg = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${BACKEND_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

const categoryFormSchema = z.object({
  nameEn: z.string().min(1, 'English name is required'),
  nameHi: z.string().optional().default(''),
  nameGu: z.string().optional().default(''),
  station: z.enum(['KITCHEN', 'BAR', 'PASTRY']),
});

const itemFormSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  nameEn: z.string().min(1, 'English name is required'),
  nameHi: z.string().optional().default(''),
  nameGu: z.string().optional().default(''),
  descriptionEn: z.string().optional().default(''),
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  image: z.string().optional().default(''),
  isVeg: z.boolean().default(true),
  isVegan: z.boolean().default(false),
  isJain: z.boolean().default(false),
  spiceLevel: z.coerce.number().min(0).max(3).default(0),
  prepTimeMin: z.coerce.number().min(1).default(12),
  allergensText: z.string().optional().default(''),
  isBestseller: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        name: z.string().min(1, 'Variant name required'),
        price: z.coerce.number().min(0),
      })
    )
    .default([]),
  addons: z
    .array(
      z.object({
        name: z.string().min(1, 'Addon name required'),
        price: z.coerce.number().min(0),
      })
    )
    .default([]),
});

export default function AdminMenuPage() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dietFilter, setDietFilter] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Category modal & drag reorder
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [draggedCatIdx, setDraggedCatIdx] = useState(null);

  // Menu item modal & image upload
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Confirm delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'item'|'category', id, name }
  const [deleting, setDeleting] = useState(false);

  const csvInputRef = useRef(null);

  const catForm = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { nameEn: '', nameHi: '', nameGu: '', station: 'KITCHEN' },
  });

  const itemForm = useForm({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      categoryId: '',
      nameEn: '',
      nameHi: '',
      nameGu: '',
      descriptionEn: '',
      price: 199,
      image: '',
      isVeg: true,
      isVegan: false,
      isJain: false,
      spiceLevel: 0,
      prepTimeMin: 12,
      allergensText: '',
      isBestseller: false,
      isAvailable: true,
      variants: [],
      addons: [],
    },
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
  } = useFieldArray({ control: itemForm.control, name: 'variants' });

  const {
    fields: addonFields,
    append: appendAddon,
    remove: removeAddon,
  } = useFieldArray({ control: itemForm.control, name: 'addons' });

  const fetchCategories = useCallback(async () => {
    const res = await api.get('/categories');
    setCategories(res.data.data.categories || []);
  }, []);

  const fetchItems = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: '12',
        });
        if (search.trim()) params.set('search', search.trim());
        if (categoryFilter) params.set('category', categoryFilter);
        if (dietFilter === 'veg') params.set('isVeg', 'true');
        if (dietFilter === 'nonveg') params.set('isVeg', 'false');
        if (dietFilter === 'jain') params.set('isJain', 'true');
        if (dietFilter === 'vegan') params.set('isVegan', 'true');

        const res = await api.get(`/menu-items?${params.toString()}`);
        setItems(res.data.data.items || []);
        setPagination(res.data.data.pagination || { page: 1, pages: 1, total: 0 });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load menu items');
      } finally {
        setLoading(false);
      }
    },
    [page, search, categoryFilter, dietFilter]
  );

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchItems(page);
  }, [fetchItems, page]);

  // Drag & Drop Category Reorder
  const handleCategoryDrop = async (targetIdx) => {
    if (draggedCatIdx === null || draggedCatIdx === targetIdx) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(draggedCatIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setCategories(reordered);
    setDraggedCatIdx(null);

    try {
      await api.patch('/categories/reorder', {
        items: reordered.map((c, idx) => ({ id: c._id, sortOrder: idx + 1 })),
      });
      toast.success('Categories reordered');
    } catch {
      toast.error('Failed to save category order');
      fetchCategories();
    }
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    catForm.reset({ nameEn: '', nameHi: '', nameGu: '', station: 'KITCHEN' });
    setCatModalOpen(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    catForm.reset({
      nameEn: cat.name?.en || '',
      nameHi: cat.name?.hi || '',
      nameGu: cat.name?.gu || '',
      station: cat.station || 'KITCHEN',
    });
    setCatModalOpen(true);
  };

  const onSaveCategory = async (values) => {
    try {
      const payload = {
        name: { en: values.nameEn, hi: values.nameHi, gu: values.nameGu },
        station: values.station,
        sortOrder: editingCategory ? editingCategory.sortOrder : categories.length + 1,
      };
      if (editingCategory) {
        await api.patch(`/categories/${editingCategory._id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/categories', payload);
        toast.success('Category created');
      }
      setCatModalOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category');
    }
  };

  // Item Modal Openers
  const openCreateItem = () => {
    setEditingItem(null);
    itemForm.reset({
      categoryId: categories[0]?._id || '',
      nameEn: '',
      nameHi: '',
      nameGu: '',
      descriptionEn: '',
      price: 199,
      image: '',
      isVeg: true,
      isVegan: false,
      isJain: false,
      spiceLevel: 0,
      prepTimeMin: 12,
      allergensText: '',
      isBestseller: false,
      isAvailable: true,
      variants: [],
      addons: [],
    });
    setItemModalOpen(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    itemForm.reset({
      categoryId: item.categoryId?._id || item.categoryId || '',
      nameEn: item.name?.en || '',
      nameHi: item.name?.hi || '',
      nameGu: item.name?.gu || '',
      descriptionEn: item.description?.en || '',
      price: item.price,
      image: item.image || '',
      isVeg: Boolean(item.isVeg),
      isVegan: Boolean(item.isVegan),
      isJain: Boolean(item.isJain),
      spiceLevel: item.spiceLevel ?? 0,
      prepTimeMin: item.prepTimeMin ?? 12,
      allergensText: (item.allergens || []).join(', '),
      isBestseller: Boolean(item.isBestseller),
      isAvailable: item.isAvailable !== false,
      variants: item.variants || [],
      addons: item.addons || [],
    });
    setItemModalOpen(true);
  };

  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/menu-items/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      itemForm.setValue('image', res.data.data.path);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Image upload failed (max 3MB JPG/PNG/WEBP)');
    } finally {
      setUploadingImg(false);
    }
  };

  const onSaveMenuItem = async (values) => {
    try {
      const payload = {
        categoryId: values.categoryId,
        name: { en: values.nameEn, hi: values.nameHi, gu: values.nameGu },
        description: { en: values.descriptionEn, hi: '', gu: '' },
        price: Number(values.price),
        image: values.image || '',
        isVeg: values.isVeg,
        isVegan: values.isVegan,
        isJain: values.isJain,
        spiceLevel: Number(values.spiceLevel),
        prepTimeMin: Number(values.prepTimeMin),
        allergens: values.allergensText
          ? values.allergensText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        isBestseller: values.isBestseller,
        isAvailable: values.isAvailable,
        variants: values.variants,
        addons: values.addons,
      };

      if (editingItem) {
        await api.patch(`/menu-items/${editingItem._id}`, payload);
        toast.success('Menu item updated');
      } else {
        await api.post('/menu-items', payload);
        toast.success('Menu item created');
      }
      setItemModalOpen(false);
      fetchItems(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save menu item');
    }
  };

  const handleToggleItemAvailability = async (item) => {
    const next = !item.isAvailable;
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, isAvailable: next } : i)));
    try {
      await api.patch(`/menu-items/${item._id}/availability`, { isAvailable: next });
      toast.success(`${item.name?.en} marked ${next ? 'Available' : 'Unavailable'}`);
    } catch {
      fetchItems(page);
    }
  };

  const handleBulkAvailability = async (makeAvailable) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          api.patch(`/menu-items/${id}/availability`, { isAvailable: makeAvailable })
        )
      );
      toast.success(`Updated ${selectedIds.length} items`);
      setSelectedIds([]);
      fetchItems(page);
    } catch {
      toast.error('Bulk update failed');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/menu-items/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'aapka-waiter-menu.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('CSV export failed');
    }
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/menu-items/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Imported ${res.data.data.importedCount} items from CSV`);
      fetchCategories();
      fetchItems(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'CSV import failed');
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'category') {
        await api.delete(`/categories/${deleteTarget.id}`);
        toast.success('Category deleted');
        fetchCategories();
      } else {
        await api.delete(`/menu-items/${deleteTarget.id}`);
        toast.success('Menu item deleted');
        fetchItems(page);
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={items.length > 0 && selectedIds.length === items.length}
          onChange={(e) =>
            setSelectedIds(e.target.checked ? items.map((i) => i._id) : [])
          }
          className="rounded accent-accent cursor-pointer"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row._id)}
          onChange={() => toggleSelectRow(row._id)}
          className="rounded accent-accent cursor-pointer"
        />
      ),
    },
    {
      key: 'item',
      label: 'Dish',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            <img
              src={resolveImg(row.image)}
              alt={row.name?.en}
              className="h-10 w-10 rounded-xl object-cover border border-border-subtle shrink-0"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-zinc-500 shrink-0">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  row.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className="font-bold text-white">{row.name?.en}</span>
              {row.isBestseller && <Sparkles className="h-3.5 w-3.5 text-accent" />}
            </div>
            {(row.name?.hi || row.name?.gu) && (
              <p className="text-[11px] text-zinc-400">
                {[row.name?.hi, row.name?.gu].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category / Station',
      render: (row) => (
        <div>
          <p className="font-semibold text-zinc-200">{row.categoryId?.name?.en || '—'}</p>
          <span className="text-[10px] font-bold uppercase text-zinc-500">
            {row.categoryId?.station || 'KITCHEN'}
          </span>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      render: (row) => <span className="font-extrabold text-white">{formatCurrency(row.price)}</span>,
    },
    {
      key: 'tags',
      label: 'Flags',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.isJain && <Badge tone="green">Jain</Badge>}
          {row.isVegan && <Badge tone="blue">Vegan</Badge>}
          {row.variants?.length > 0 && (
            <Badge tone="neutral">{row.variants.length} Variants</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'availability',
      label: 'Available',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleItemAvailability(row)}
          className={cn(
            'relative inline-flex h-5 w-10 rounded-full border-2 border-transparent transition-colors cursor-pointer',
            row.isAvailable ? 'bg-emerald-500' : 'bg-zinc-700'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition',
              row.isAvailable ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => openEditItem(row)}>
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              setDeleteTarget({ type: 'item', id: row._id, name: row.name?.en })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const previewImgUrl = resolveImg(itemForm.watch('image'));

  return (
    <div className="space-y-6">
      {/* Header & CSV Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div>
          <h1 className="text-lg font-extrabold text-white">Menu &amp; Catalog Management</h1>
          <p className="text-xs text-zinc-400">
            Drag categories to reorder • Multilingual dishes • Bulk CSV import/export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCsv}
            className="hidden"
          />
          <Button variant="secondary" size="sm" onClick={() => csvInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 text-accent" />
            Import CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5 text-accent" />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateItem}>
            <Plus className="h-4 w-4" />
            Add Menu Item
          </Button>
        </div>
      </div>

      {/* Categories Bar (Drag to Reorder) */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Categories (Drag cards to reorder)
          </h2>
          <Button variant="secondary" size="sm" onClick={openCreateCategory}>
            <Plus className="h-3.5 w-3.5 text-accent" />
            New Category
          </Button>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          {categories.map((cat, idx) => (
            <div
              key={cat._id}
              draggable
              onDragStart={() => setDraggedCatIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleCategoryDrop(idx)}
              className="flex items-center gap-2.5 rounded-2xl bg-surface-2 border border-border-subtle hover:border-accent/45 px-3.5 py-2.5 shrink-0 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-zinc-500" />
              <div>
                <p className="text-xs font-bold text-white">{cat.name?.en}</p>
                <p className="text-[10px] text-zinc-400">{cat.station}</p>
              </div>
              <div className="flex items-center gap-1 pl-1">
                <button
                  type="button"
                  onClick={() => openEditCategory(cat)}
                  className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({ type: 'category', id: cat._id, name: cat.name?.en })
                  }
                  className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Search, Filter & Bulk Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="w-full sm:w-64">
            <Input
              icon={Search}
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="w-44">
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({ value: c._id, label: c.name?.en })),
              ]}
            />
          </div>

          <div className="w-40">
            <Select
              value={dietFilter}
              onChange={(e) => {
                setDietFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Diets' },
                { value: 'veg', label: 'Pure Veg' },
                { value: 'nonveg', label: 'Non-Veg' },
                { value: 'jain', label: 'Jain' },
                { value: 'vegan', label: 'Vegan' },
              ]}
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-accent/15 border border-accent/40 px-3.5 py-2">
            <CheckSquare className="h-4 w-4 text-accent" />
            <span className="text-xs font-bold text-white">{selectedIds.length} selected</span>
            <Button size="sm" variant="success" onClick={() => handleBulkAvailability(true)}>
              Set In Stock
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleBulkAvailability(false)}>
              Mark Out
            </Button>
          </div>
        )}
      </div>

      {/* Menu Items DataTable */}
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onPageChange={setPage}
      />

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={catForm.handleSubmit(onSaveCategory)} className="space-y-4">
          <Input
            label="English Name *"
            {...catForm.register('nameEn')}
            error={catForm.formState.errors.nameEn?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hindi Name (हिंदी)" {...catForm.register('nameHi')} />
            <Input label="Gujarati Name (ગુજરાતી)" {...catForm.register('nameGu')} />
          </div>
          <Select
            label="Prep Station"
            {...catForm.register('station')}
            options={[
              { value: 'KITCHEN', label: 'Kitchen' },
              { value: 'BAR', label: 'Bar / Beverages' },
              { value: 'PASTRY', label: 'Pastry / Desserts' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={catForm.formState.isSubmitting}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Menu Item Modal */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingItem ? `Edit ${editingItem.name?.en}` : 'Add New Menu Item'}
        className="max-w-2xl"
      >
        <form onSubmit={itemForm.handleSubmit(onSaveMenuItem)} className="space-y-4">
          {/* Image Upload & Preview */}
          <div className="flex items-center gap-4 rounded-2xl bg-surface-2 border border-border-subtle p-3.5">
            {previewImgUrl ? (
              <img
                src={previewImgUrl}
                alt="Preview"
                className="h-16 w-16 rounded-xl object-cover border border-border-strong"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-1 text-zinc-500">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="inline-flex items-center gap-2 rounded-xl bg-surface-1 hover:bg-surface-3 border border-border-strong px-3.5 py-2 text-xs font-bold text-white cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-accent" />
                {uploadingImg ? 'Uploading...' : 'Upload Dish Photo (Max 3MB)'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-zinc-400">JPG, PNG, or WEBP supported</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Category (Determines Station) *"
              {...itemForm.register('categoryId')}
              error={itemForm.formState.errors.categoryId?.message}
              options={categories.map((c) => ({
                value: c._id,
                label: `${c.name?.en} (${c.station})`,
              }))}
            />
            <Input
              label="Base Price (₹) *"
              type="number"
              step="0.01"
              {...itemForm.register('price')}
              error={itemForm.formState.errors.price?.message}
            />
          </div>

          {/* Multilingual Names */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Name (English) *"
              {...itemForm.register('nameEn')}
              error={itemForm.formState.errors.nameEn?.message}
            />
            <Input label="Name (Hindi)" {...itemForm.register('nameHi')} />
            <Input label="Name (Gujarati)" {...itemForm.register('nameGu')} />
          </div>

          <Input label="Description (English)" {...itemForm.register('descriptionEn')} />

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Spice Level"
              {...itemForm.register('spiceLevel')}
              options={[
                { value: 0, label: '0 - Mild / None' },
                { value: 1, label: '1 - Medium' },
                { value: 2, label: '2 - Spicy' },
                { value: 3, label: '3 - Extra Hot' },
              ]}
            />
            <Input
              label="Prep Time (mins)"
              type="number"
              min={1}
              {...itemForm.register('prepTimeMin')}
            />
            <Input
              label="Allergens (comma-sep)"
              placeholder="Dairy, Gluten, Nuts"
              {...itemForm.register('allergensText')}
            />
          </div>

          {/* Dietary & Feature Checkboxes */}
          <div className="flex flex-wrap gap-4 rounded-xl bg-surface-2 p-3 text-xs font-semibold text-zinc-200">
            {[
              { name: 'isVeg', label: 'Vegetarian' },
              { name: 'isVegan', label: 'Vegan' },
              { name: 'isJain', label: 'Jain' },
              { name: 'isBestseller', label: 'Bestseller' },
              { name: 'isAvailable', label: 'In Stock' },
            ].map((flag) => (
              <label key={flag.name} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...itemForm.register(flag.name)}
                  className="rounded accent-accent"
                />
                <span>{flag.label}</span>
              </label>
            ))}
          </div>

          {/* Dynamic Variants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300">Variants (e.g. 9 Inch / 12 Inch)</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => appendVariant({ name: '', price: 0 })}
              >
                + Add Variant
              </Button>
            </div>
            {variantFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder="Variant name"
                  {...itemForm.register(`variants.${index}.name`)}
                />
                <Input
                  type="number"
                  placeholder="Price"
                  {...itemForm.register(`variants.${index}.price`)}
                />
                <Button type="button" size="sm" variant="danger" onClick={() => removeVariant(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Dynamic Add-ons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300">Add-ons (e.g. Extra Cheese)</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => appendAddon({ name: '', price: 0 })}
              >
                + Add Add-on
              </Button>
            </div>
            {addonFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder="Add-on name"
                  {...itemForm.register(`addons.${index}.name`)}
                />
                <Input
                  type="number"
                  placeholder="Price"
                  {...itemForm.register(`addons.${index}.price`)}
                />
                <Button type="button" size="sm" variant="danger" onClick={() => removeAddon(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="secondary" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={itemForm.formState.isSubmitting}>
              {editingItem ? 'Save Changes' : 'Create Menu Item'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={`Delete ${deleteTarget?.type === 'category' ? 'Category' : 'Menu Item'}?`}
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
      />
    </div>
  );
}
