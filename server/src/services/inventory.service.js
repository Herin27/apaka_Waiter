import { Ingredient, MenuItem } from '../models/index.js';
import { emitToBranch } from '../sockets/index.js';

export const deductInventoryForOrder = async (order, actorLabel = 'ORDER_CONFIRMED') => {
  try {
    const menuIds = order.items.map((i) => i.menuItemId);
    const menuItems = await MenuItem.find({ _id: { $in: menuIds } }).lean();
    const menuMap = new Map(menuItems.map((m) => [String(m._id), m]));

    const deductionsByIngredient = new Map();

    for (const orderItem of order.items) {
      if (['CANCELLED', 'REJECTED'].includes(orderItem.status)) continue;
      const mItem = menuMap.get(String(orderItem.menuItemId));
      if (!mItem || !Array.isArray(mItem.recipe)) continue;

      for (const r of mItem.recipe) {
        const ingId = String(r.ingredientId);
        const totalQty = Number(r.qtyPerServing || 0) * Number(orderItem.qty || 1);
        deductionsByIngredient.set(ingId, (deductionsByIngredient.get(ingId) || 0) + totalQty);
      }
    }

    for (const [ingId, qtyToDeduct] of deductionsByIngredient.entries()) {
      const ingredient = await Ingredient.findById(ingId);
      if (!ingredient) continue;

      const nextStock = Math.max(0, Number((ingredient.currentStock - qtyToDeduct).toFixed(3)));
      ingredient.currentStock = nextStock;
      ingredient.movements.push({
        type: 'ORDER_DEDUCT',
        delta: -qtyToDeduct,
        balanceAfter: nextStock,
        reason: `Order ${order.orderNo}`,
        by: actorLabel,
        at: new Date(),
      });
      await ingredient.save();

      if (nextStock <= ingredient.lowStockThreshold) {
        emitToBranch(order.branchId, 'inventory:low', {
          ingredientId: ingredient._id,
          name: ingredient.name,
          currentStock: ingredient.currentStock,
          unit: ingredient.unit,
          lowStockThreshold: ingredient.lowStockThreshold,
        });
      }
    }
  } catch (err) {
    console.error('⚠️ Inventory auto-deduction error:', err.message);
  }
};
