import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
export const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ID format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Auth & Staff (Part 2)
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email is required').transform((v) => v.trim().toLowerCase()),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(64, 'New password must be at most 64 characters'),
  }),
});

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(80).trim(),
    email: z.string().email('Valid email is required').transform((v) => v.trim().toLowerCase()),
    phone: z.string().max(20).trim().optional().default(''),
    password: z.string().min(8, 'Password must be at least 8 characters').max(64),
    role: z.enum(['superadmin', 'admin', 'waiter', 'kitchen', 'cashier']),
    branchId: objectIdSchema.optional(),
    assignedTables: z.array(objectIdSchema).optional().default([]),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      name: z.string().min(2).max(80).trim().optional(),
      phone: z.string().max(20).trim().optional(),
      password: z.string().min(8).max(64).optional(),
      role: z.enum(['superadmin', 'admin', 'waiter', 'kitchen', 'cashier']).optional(),
      isActive: z.boolean().optional(),
      assignedTables: z.array(objectIdSchema).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export const staffIdParamSchema = idParamSchema;

// Categories (Part 3)
const localizedNameSchema = z.object({
  en: z.string().min(1, 'English name is required').trim(),
  hi: z.string().trim().optional().default(''),
  gu: z.string().trim().optional().default(''),
});

const localizedDescSchema = z.object({
  en: z.string().trim().optional().default(''),
  hi: z.string().trim().optional().default(''),
  gu: z.string().trim().optional().default(''),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: localizedNameSchema,
    sortOrder: z.number().int().optional().default(0),
    station: z.enum(['KITCHEN', 'BAR', 'PASTRY']).optional().default('KITCHEN'),
    isActive: z.boolean().optional().default(true),
    branchId: objectIdSchema.optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: localizedNameSchema.partial().optional(),
      sortOrder: z.number().int().optional(),
      station: z.enum(['KITCHEN', 'BAR', 'PASTRY']).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const reorderCategoriesSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          id: objectIdSchema,
          sortOrder: z.number().int(),
        })
      )
      .min(1, 'At least one category sort item is required'),
  }),
});

// Menu Items (Part 3)
const variantItemSchema = z.object({
  name: z.string().min(1).trim(),
  price: z.number().min(0),
});

const addonItemSchema = z.object({
  name: z.string().min(1).trim(),
  price: z.number().min(0),
});

export const createMenuItemSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,
    name: localizedNameSchema,
    description: localizedDescSchema.optional().default({ en: '', hi: '', gu: '' }),
    price: z.number().min(0),
    image: z.string().trim().optional().default(''),
    isVeg: z.boolean().optional().default(true),
    isVegan: z.boolean().optional().default(false),
    isJain: z.boolean().optional().default(false),
    spiceLevel: z.number().int().min(0).max(3).optional().default(0),
    allergens: z.array(z.string().trim()).optional().default([]),
    prepTimeMin: z.number().int().min(1).optional().default(12),
    variants: z.array(variantItemSchema).optional().default([]),
    addons: z.array(addonItemSchema).optional().default([]),
    isAvailable: z.boolean().optional().default(true),
    isBestseller: z.boolean().optional().default(false),
    tags: z.array(z.string().trim()).optional().default([]),
    branchId: objectIdSchema.optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      categoryId: objectIdSchema.optional(),
      name: localizedNameSchema.partial().optional(),
      description: localizedDescSchema.partial().optional(),
      price: z.number().min(0).optional(),
      image: z.string().trim().optional(),
      isVeg: z.boolean().optional(),
      isVegan: z.boolean().optional(),
      isJain: z.boolean().optional(),
      spiceLevel: z.number().int().min(0).max(3).optional(),
      allergens: z.array(z.string().trim()).optional(),
      prepTimeMin: z.number().int().min(1).optional(),
      variants: z.array(variantItemSchema).optional(),
      addons: z.array(addonItemSchema).optional(),
      isAvailable: z.boolean().optional(),
      isBestseller: z.boolean().optional(),
      tags: z.array(z.string().trim()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const toggleAvailabilitySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    isAvailable: z.boolean().optional(),
  }),
});

// Tables (Part 3 & 4)
export const createTableSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Table name is required').max(30).trim(),
    seats: z.number().int().min(1).max(30).optional().default(4),
    shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).optional().default('SQUARE'),
    x: z.number().optional().default(0),
    y: z.number().optional().default(0),
    section: z.string().max(50).trim().optional().default('Main Hall'),
    isActive: z.boolean().optional().default(true),
    branchId: objectIdSchema.optional(),
  }),
});

export const updateTableSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: z.string().min(1).max(30).trim().optional(),
      seats: z.number().int().min(1).max(30).optional(),
      shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      section: z.string().max(50).trim().optional(),
      isActive: z.boolean().optional(),
      status: z
        .enum(['EMPTY', 'SEATED', 'ORDERING', 'WAITING', 'PREPARING', 'READY', 'NEEDS_BILL', 'NEEDS_HELP'])
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const updateTableLayoutSchema = z.object({
  body: z.object({
    tables: z
      .array(
        z.object({
          id: objectIdSchema,
          x: z.number(),
          y: z.number(),
          shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).optional(),
        })
      )
      .min(1, 'At least one table layout entry is required'),
  }),
});

export const transferTableSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    toTableId: objectIdSchema,
  }),
});

export const mergeTablesSchema = z.object({
  body: z.object({
    primaryTableId: objectIdSchema,
    secondaryTableIds: z.array(objectIdSchema).min(1, 'At least one secondary table ID is required'),
  }),
});

// Sessions, Cart, Orders & Calls (Part 4)
export const startSessionSchema = z.object({
  body: z.object({
    branchSlug: z.string().min(1).trim().toLowerCase(),
    qrToken: z.string().min(1).trim(),
    nickname: z.string().min(1).max(30).trim().optional(),
  }),
});

export const addCartItemSchema = z.object({
  body: z.object({
    menuItemId: objectIdSchema,
    qty: z.number().int().min(1).max(50).default(1),
    variantName: z.string().trim().optional(),
    addonNames: z.array(z.string().trim()).optional().default([]),
    note: z.string().max(250).trim().optional().default(''),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    cartItemId: objectIdSchema,
  }),
  body: z
    .object({
      qty: z.number().int().min(0).max(50).optional(),
      note: z.string().max(250).trim().optional(),
    })
    .refine((d) => d.qty !== undefined || d.note !== undefined, {
      message: 'Provide qty or note to update',
    }),
});

export const deleteCartItemSchema = z.object({
  params: z.object({
    cartItemId: objectIdSchema,
  }),
});

export const placeCustomerOrderSchema = z.object({
  body: z.object({
    idempotencyKey: z.string().min(4, 'idempotencyKey is required').max(120).trim(),
  }),
});

export const waiterCreateOrderSchema = z.object({
  body: z.object({
    tableId: objectIdSchema,
    idempotencyKey: z.string().min(4).max(120).trim(),
    items: z
      .array(
        z.object({
          menuItemId: objectIdSchema,
          qty: z.number().int().min(1).max(50),
          variantName: z.string().trim().optional(),
          addonNames: z.array(z.string().trim()).optional().default([]),
          note: z.string().max(250).trim().optional().default(''),
        })
      )
      .min(1, 'Order must have at least one item'),
  }),
});

export const rejectOrderSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    reason: z.string().min(2, 'Rejection reason is required').max(300).trim(),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    reason: z.string().min(2, 'Cancellation reason is required').max(300).trim(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(['PREPARING', 'READY', 'SERVED']),
  }),
});

export const updateOrderItemStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    itemId: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
  }),
});

export const createWaiterCallSchema = z.object({
  body: z.object({
    type: z.enum(['WAITER', 'WATER', 'BILL', 'CLEAN', 'HELP']),
  }),
});
