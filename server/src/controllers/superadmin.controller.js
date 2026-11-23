import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import {
  Branch,
  Category,
  Lead,
  MenuItem,
  Order,
  Restaurant,
  Table,
  TableSession,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signTableToken } from '../utils/signTableToken.js';
import { generateOrderNo } from '../utils/generateOrderNo.js';
import { emitToBranch } from '../sockets/index.js';

// POST /api/v1/public/leads (Landing page demo request form)
export const createDemoLead = asyncHandler(async (req, res, next) => {
  const { name, email, phone, restaurantName, tablesCount, planInterest, notes } = req.body;
  if (!name || !email || !restaurantName) {
    return next(new ApiError(400, 'Name, email, and restaurant name are required.'));
  }

  const lead = await Lead.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone || '').trim(),
    restaurantName: String(restaurantName).trim(),
    tablesCount: Number(tablesCount || 10),
    planInterest: planInterest || 'GROWTH',
    notes: String(notes || '').trim(),
  });

  // Email-ready stub log
  console.log(`📩 [DEMO LEAD CAPTURED] ${lead.restaurantName} (${lead.email}) -> Plan: ${lead.planInterest}`);

  res.status(201).json({
    success: true,
    data: {
      message: 'Demo request received! Our hospitality team will reach out shortly.',
      lead,
    },
  });
});

// GET /api/v1/public/demo/info -> Returns seeded demo branch & T1 qrToken for /demo route
export const getDemoPublicInfo = asyncHandler(async (_req, res, next) => {
  const branch = await Branch.findOne({ slug: 'demo-cafe', isActive: true });
  if (!branch) return next(new ApiError(404, 'Demo branch not seeded yet.'));

  const tableT1 = await Table.findOne({ branchId: branch._id, name: 'T1' });
  if (!tableT1) return next(new ApiError(404, 'Demo Table T1 not found.'));

  res.status(200).json({
    success: true,
    data: {
      branchSlug: branch.slug,
      branchName: branch.name,
      qrToken: tableT1.qrToken,
      tableName: tableT1.name,
    },
  });
});

// POST /api/v1/demo/simulate-customer (Admin-only random order simulation)
export const simulateRandomCustomerOrder = asyncHandler(async (req, res, next) => {
  const branchId = req.body?.branchId || req.user.branchId;
  const branch = await Branch.findById(branchId);
  if (!branch) return next(new ApiError(404, 'Branch not found.'));

  const tables = await Table.find({ branchId: branch._id, isActive: true });
  const menuItems = await MenuItem.find({ branchId: branch._id, isAvailable: true });
  if (!tables.length || !menuItems.length) {
    return next(new ApiError(400, 'Need active tables and menu items to simulate an order.'));
  }

  const chosenTable = tables[Math.floor(Math.random() * tables.length)];
  const itemA = menuItems[Math.floor(Math.random() * menuItems.length)];
  const itemB = menuItems[Math.floor(Math.random() * menuItems.length)];

  let session = await TableSession.findOne({
    branchId: branch._id,
    tableId: chosenTable._id,
    status: 'OPEN',
  });
  if (!session) {
    session = await TableSession.create({
      branchId: branch._id,
      tableId: chosenTable._id,
      status: 'OPEN',
      guests: [{ id: `sim_${nanoid(6)}`, nickname: 'Simulated Guest' }],
      cart: [],
    });
  }

  const orderItems = [itemA, itemB].map((m) => ({
    menuItemId: m._id,
    name: m.name.en,
    price: m.price,
    qty: 1,
    station: 'KITCHEN',
    status: 'PLACED',
    addedByGuest: 'Simulated Guest',
  }));

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;
  const orderNo = await generateOrderNo(branch._id);

  const order = await Order.create({
    branchId: branch._id,
    sessionId: session._id,
    tableId: chosenTable._id,
    orderNo,
    status: 'PLACED',
    items: orderItems,
    subtotal,
    tax,
    total,
    idempotencyKey: `sim_${Date.now()}_${nanoid(6)}`,
    placedBy: 'CUSTOMER',
    events: [{ from: null, to: 'PLACED', by: 'Simulator', at: new Date() }],
  });

  chosenTable.status = 'WAITING';
  await chosenTable.save();

  const populated = await Order.findById(order._id).populate('tableId', 'name section');
  emitToBranch(branch._id, 'order:new', { order: populated });
  emitToBranch(branch._id, 'table:updated', { table: chosenTable });

  res.status(201).json({
    success: true,
    data: {
      message: `Simulated customer order ${order.orderNo} at Table ${chosenTable.name}`,
      order: populated,
    },
  });
});

// ==========================================
// SUPERADMIN PANEL (/dashboard/super)
// ==========================================

// GET /api/v1/super/restaurants
export const listAllRestaurants = asyncHandler(async (_req, res) => {
  const restaurants = await Restaurant.find().sort({ createdAt: -1 }).lean();
  const branches = await Branch.find().lean();
  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } })
    .select('name email restaurantId role isActive')
    .lean();

  const enriched = restaurants.map((r) => {
    const rBranches = branches.filter((b) => String(b.restaurantId) === String(r._id));
    const rAdmins = admins.filter((a) => String(a.restaurantId) === String(r._id));
    return {
      ...r,
      plan: r.plan || 'GROWTH',
      isActive: rBranches.some((b) => b.isActive),
      branchesCount: rBranches.length,
      admins: rAdmins,
    };
  });

  res.status(200).json({ success: true, data: { restaurants: enriched } });
});

// POST /api/v1/super/restaurants -> creates restaurant + default branch + first admin user
export const createRestaurantWithAdmin = asyncHandler(async (req, res, next) => {
  const {
    restaurantName,
    branchName,
    branchSlug,
    gstin = '',
    adminName,
    adminEmail,
    adminPassword,
  } = req.body;

  if (!restaurantName || !adminEmail || !adminPassword) {
    return next(
      new ApiError(400, 'restaurantName, adminEmail, and adminPassword are required.')
    );
  }

  const existingUser = await User.findOne({ email: String(adminEmail).trim().toLowerCase() });
  if (existingUser) {
    return next(new ApiError(409, 'A user with this admin email already exists.'));
  }

  const restaurant = await Restaurant.create({
    name: String(restaurantName).trim(),
    gstin: String(gstin || '').trim(),
    currency: 'INR',
  });

  const slugBase =
    String(branchSlug || restaurantName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `branch-${nanoid(5)}`;

  const branch = await Branch.create({
    restaurantId: restaurant._id,
    name: String(branchName || `${restaurantName} Main`).trim(),
    slug: `${slugBase}-${nanoid(4).toLowerCase()}`,
    isActive: true,
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await User.create({
    restaurantId: restaurant._id,
    branchId: branch._id,
    name: String(adminName || 'Branch Admin').trim(),
    email: String(adminEmail).trim().toLowerCase(),
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  const defaultCat = await Category.create({
    branchId: branch._id,
    name: { en: 'Chef Specials', hi: '', gu: '' },
    sortOrder: 1,
    station: 'KITCHEN',
  });

  await MenuItem.create({
    branchId: branch._id,
    categoryId: defaultCat._id,
    name: { en: 'Signature House Special', hi: '', gu: '' },
    price: 249,
    isVeg: true,
  });

  await Table.create({
    branchId: branch._id,
    name: 'T1',
    seats: 4,
    shape: 'SQUARE',
    x: 30,
    y: 45,
    qrToken: signTableToken(),
    isActive: true,
  });

  res.status(201).json({
    success: true,
    data: {
      restaurant,
      branch,
      admin: { id: adminUser._id, name: adminUser.name, email: adminUser.email },
    },
  });
});

// PATCH /api/v1/super/restaurants/:id/toggle-status
export const toggleRestaurantStatus = asyncHandler(async (req, res, next) => {
  const { isActive } = req.body;
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) return next(new ApiError(404, 'Restaurant not found.'));

  const nextActive = typeof isActive === 'boolean' ? isActive : false;
  await Branch.updateMany({ restaurantId: restaurant._id }, { $set: { isActive: nextActive } });

  res.status(200).json({
    success: true,
    data: {
      message: `Restaurant ${nextActive ? 'activated' : 'suspended'}.`,
      isActive: nextActive,
    },
  });
});
