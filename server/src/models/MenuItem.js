import mongoose from 'mongoose';

const localizedTextSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    hi: { type: String, trim: true, default: '' },
    gu: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const localizedOptionalTextSchema = new mongoose.Schema(
  {
    en: { type: String, trim: true, default: '' },
    hi: { type: String, trim: true, default: '' },
    gu: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const addonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const recipeItemSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    qtyPerServing: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
);

const menuItemSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    name: { type: localizedTextSchema, required: true },
    description: { type: localizedOptionalTextSchema, default: () => ({}) },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    isVeg: { type: Boolean, default: true },
    isVegan: { type: Boolean, default: false },
    isJain: { type: Boolean, default: false },
    spiceLevel: { type: Number, min: 0, max: 3, default: 0 },
    allergens: { type: [String], default: [] },
    prepTimeMin: { type: Number, default: 12, min: 1 },
    variants: { type: [variantSchema], default: [] },
    addons: { type: [addonSchema], default: [] },
    recipe: { type: [recipeItemSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    isBestseller: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

menuItemSchema.index({ branchId: 1, categoryId: 1, isAvailable: 1 });

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);
