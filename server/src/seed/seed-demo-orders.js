import { connectDB } from '../config/db.js';
import {
  Branch,
  Customer,
  Feedback,
  Ingredient,
  MenuItem,
  Order,
  Payment,
  Restaurant,
  Table,
  TableSession,
  User,
} from '../models/index.js';

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const seedDemoAnalytics = async () => {
  await connectDB();

  const branch = await Branch.findOne({ slug: 'demo-cafe' });
  if (!branch) {
    console.error('❌ Run `npm run seed` first so demo-cafe exists.');
    process.exit(1);
  }

  const restaurant = await Restaurant.findById(branch.restaurantId);
  const tables = await Table.find({ branchId: branch._id });
  const menuItems = await MenuItem.find({ branchId: branch._id });
  const waiter = await User.findOne({ branchId: branch._id, role: 'waiter' });

  console.log('📊 Seeding 30 days of realistic orders, payments, inventory, loyalty & feedback...');

  // Seed sample ingredients & attach recipes to first 4 items
  const ingDocs = await Ingredient.insertMany(
    [
      { branchId: branch._id, name: 'Paneer (Cottage Cheese)', unit: 'kg', currentStock: 18, lowStockThreshold: 5, costPerUnit: 340 },
      { branchId: branch._id, name: 'Arabica Espresso Beans', unit: 'kg', currentStock: 4.2, lowStockThreshold: 5, costPerUnit: 850 },
      { branchId: branch._id, name: 'San Marzano Tomato Sauce', unit: 'l', currentStock: 14, lowStockThreshold: 4, costPerUnit: 220 },
      { branchId: branch._id, name: 'Mozzarella Fior di Latte', unit: 'kg', currentStock: 11, lowStockThreshold: 3, costPerUnit: 480 },
      { branchId: branch._id, name: 'Fresh Hass Avocado', unit: 'pcs', currentStock: 9, lowStockThreshold: 12, costPerUnit: 75 },
    ],
    { ordered: false }
  ).catch(() => Ingredient.find({ branchId: branch._id }));

  if (ingDocs.length >= 2 && menuItems.length >= 2) {
    await MenuItem.findByIdAndUpdate(menuItems[0]._id, {
      recipe: [{ ingredientId: ingDocs[4]?._id || ingDocs[0]._id, qtyPerServing: 1 }],
    });
    await MenuItem.findByIdAndUpdate(menuItems[2]._id, {
      recipe: [{ ingredientId: ingDocs[0]._id, qtyPerServing: 0.15 }],
    });
  }

  // Seed Loyalty Customers
  await Customer.insertMany(
    [
      { restaurantId: restaurant._id, name: 'Devansh Shah', phone: '+919825011111', points: 420, tier: 'GOLD', visitCount: 9, totalSpent: 8450 },
      { restaurantId: restaurant._id, name: 'Ananya Mehta', phone: '+919825022222', points: 980, tier: 'PLATINUM', visitCount: 18, totalSpent: 19200 },
      { restaurantId: restaurant._id, name: 'Riya Trivedi', phone: '+919825033333', points: 160, tier: 'SILVER', visitCount: 4, totalSpent: 3200 },
      { restaurantId: restaurant._id, name: 'Kabir Joshi', phone: '+919825044444', points: 75, tier: 'BRONZE', visitCount: 2, totalSpent: 1150 },
    ],
    { ordered: false }
  ).catch(() => {});

  const methods = ['UPI', 'UPI', 'CARD', 'CASH', 'RAZORPAY'];
  const sampleComments = [
    'Avocado Dahi Puri and Vietnamese Latte were extraordinary!',
    'Super fast QR ordering and warm hospitality.',
    'Loved the wood-fired pizza crust, will visit again.',
    'Good food, slightly busy during peak dinner hour.',
    'Best cafe ambience in Ahmedabad!',
  ];

  let createdCount = 0;

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const ordersToday = randInt(4, 9);
    for (let j = 0; j < ordersToday; j++) {
      const table = pick(tables);
      const hour = pick([10, 12, 13, 14, 17, 19, 20, 21, 22]);
      const placedAt = new Date(Date.now() - daysAgo * 86400000);
      placedAt.setHours(hour, randInt(0, 55), 0, 0);

      const confirmedAt = new Date(placedAt.getTime() + randInt(1, 4) * 60000);
      const preparingAt = new Date(confirmedAt.getTime() + randInt(1, 3) * 60000);
      const readyAt = new Date(preparingAt.getTime() + randInt(8, 16) * 60000);
      const servedAt = new Date(readyAt.getTime() + randInt(1, 5) * 60000);
      const closedAt = new Date(servedAt.getTime() + randInt(15, 35) * 60000);

      const session = await TableSession.create({
        branchId: branch._id,
        tableId: table._id,
        status: 'CLOSED',
        guests: [{ id: 'gst_demo', nickname: 'Guest 1' }],
        startedAt: placedAt,
        closedAt,
      });

      const chosenItems = [pick(menuItems), pick(menuItems)];
      let subtotal = 0;
      const orderItems = chosenItems.map((m) => {
        const qty = randInt(1, 2);
        subtotal += m.price * qty;
        return {
          menuItemId: m._id,
          name: m.name.en,
          price: m.price,
          qty,
          station: 'KITCHEN',
          status: 'PAID',
          addedByGuest: 'Guest 1',
        };
      });

      const tax = Math.round(subtotal * 0.05);
      const total = subtotal + tax;
      const orderNo = `A-${2000 + createdCount}`;

      const order = await Order.create({
        branchId: branch._id,
        sessionId: session._id,
        tableId: table._id,
        orderNo,
        status: 'PAID',
        items: orderItems,
        subtotal,
        tax,
        serviceCharge: 0,
        discount: 0,
        total,
        idempotencyKey: `demo_seed_${daysAgo}_${j}_${Date.now()}`,
        placedBy: 'CUSTOMER',
        createdAt: placedAt,
        updatedAt: closedAt,
        events: [
          { from: null, to: 'PLACED', by: 'Guest 1', at: placedAt },
          { from: 'PLACED', to: 'CONFIRMED', by: waiter ? `${waiter.name} (waiter)` : 'Rohan Sharma (waiter)', at: confirmedAt },
          { from: 'CONFIRMED', to: 'PREPARING', by: 'Chef Vikram (kitchen)', at: preparingAt },
          { from: 'PREPARING', to: 'READY', by: 'Chef Vikram (kitchen)', at: readyAt },
          { from: 'READY', to: 'SERVED', by: waiter ? `${waiter.name} (waiter)` : 'Rohan Sharma (waiter)', at: servedAt },
          { from: 'SERVED', to: 'PAID', by: 'Priya Desai (cashier)', at: closedAt },
        ],
      });

      await Payment.create({
        branchId: branch._id,
        sessionId: session._id,
        tableId: table._id,
        orderIds: [order._id],
        amount: total,
        method: pick(methods),
        status: 'COMPLETED',
        paidAt: closedAt,
        createdAt: closedAt,
      });

      if (j % 3 === 0) {
        const rating = pick([4, 5, 5, 5, 3]);
        await Feedback.create({
          branchId: branch._id,
          sessionId: session._id,
          tableId: table._id,
          rating,
          foodRating: rating,
          serviceRating: Math.min(5, rating + 1),
          comment: pick(sampleComments),
          guestName: 'Guest 1',
          createdAt: closedAt,
        });
      }

      createdCount++;
    }
  }

  console.log(`✅ Generated ${createdCount} historical orders, payments, inventory & feedback records!`);
  process.exit(0);
};

seedDemoAnalytics().catch((err) => {
  console.error('❌ Demo orders seed failed:', err);
  process.exit(1);
});
