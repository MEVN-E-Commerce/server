import User from '../../models/User.js';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import Order from '../orders/order.model.js';
import Banner from '../../models/Banner.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../orders/constants.js';
import { uploadImage } from '../../utils/cloudinary.js';

// ─── Safe user projection (strips sensitive fields) ────────────────────────
const SAFE_USER_PROJECTION = '-passwordHash -emailVerificationToken -emailVerificationExpires';

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

/**
 * Aggregate all dashboard statistics in parallel
 */
export const getDashboardStats = async () => {
  const [
    totalUsers,
    totalSellers,
    totalCustomers,
    totalProducts,
    activeProducts,
    inactiveProducts,
    totalCategories,
    orderStats,
    revenueData,
    recentOrders,
    recentUsers,
    topProducts,
    recentSellers
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'seller' }),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: false }),
    Category.countDocuments(),
    // Order counts by status
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    // Total revenue from paid orders
    Order.aggregate([
      { $match: { paymentStatus: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    // Recent 8 orders
    Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('userId', 'name email')
      .lean(),
    // Recent 6 registered users
    User.find()
      .select(SAFE_USER_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    // Top 5 products by revenue (from order items)
    Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]),
    // Recently registered sellers
    User.find({ role: 'seller' })
      .select(SAFE_USER_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
  ]);

  // Transform order stats array into a keyed object
  const orderStatusMap = {};
  orderStats.forEach(s => { orderStatusMap[s._id] = s.count; });

  return {
    users: {
      total: totalUsers,
      sellers: totalSellers,
      customers: totalCustomers
    },
    products: {
      total: totalProducts,
      active: activeProducts,
      inactive: inactiveProducts
    },
    categories: { total: totalCategories },
    orders: {
      total: Object.values(orderStatusMap).reduce((a, b) => a + b, 0),
      pending: orderStatusMap[ORDER_STATUS.PENDING] || 0,
      paid: orderStatusMap[ORDER_STATUS.PAID] || 0,
      processing: orderStatusMap[ORDER_STATUS.PROCESSING] || 0,
      shipped: orderStatusMap[ORDER_STATUS.SHIPPED] || 0,
      delivered: orderStatusMap[ORDER_STATUS.DELIVERED] || 0,
      cancelled: orderStatusMap[ORDER_STATUS.CANCELLED] || 0
    },
    revenue: revenueData[0]?.total || 0,
    recentOrders,
    recentUsers,
    topProducts,
    recentSellers
  };
};

// ─── USERS ─────────────────────────────────────────────────────────────────

export const listUsers = async ({ search, role, isActive, isVerified, page = 1, limit = 15, sort = 'createdAt', order = 'desc' }) => {
  const query = {};

  if (search) {
    const regex = { $regex: search.trim(), $options: 'i' };
    query.$or = [{ name: regex }, { email: regex }];
  }
  if (role) query.role = role;
  if (isActive !== undefined && isActive !== '') {
    query.isActive = isActive === 'true' || isActive === true;
  }
  if (isVerified !== undefined && isVerified !== '') {
    query.isVerified = isVerified === 'true' || isVerified === true;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

  const [users, total] = await Promise.all([
    User.find(query)
      .select(SAFE_USER_PROJECTION)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(query)
  ]);

  return { users, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
};

export const getUserById = async (id) => {
  const user = await User.findById(id).select(SAFE_USER_PROJECTION).lean();
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
};

// Protected fields that admin CANNOT change via this endpoint
const PROTECTED_USER_FIELDS = ['passwordHash', 'email', 'emailVerificationToken', 'emailVerificationExpires', '_id', '__v'];

export const updateUserStatus = async (id, updates) => {
  // Strip any protected fields from updates
  PROTECTED_USER_FIELDS.forEach(f => delete updates[f]);

  const user = await User.findById(id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Prevent admin from accidentally locking themselves out
  if (updates.isActive === false && user.role === 'admin') {
    const err = new Error('Cannot deactivate an admin account');
    err.statusCode = 400;
    throw err;
  }

  Object.assign(user, updates);
  await user.save();

  const userObj = user.toObject();
  delete userObj.passwordHash;
  delete userObj.emailVerificationToken;
  delete userObj.emailVerificationExpires;
  return userObj;
};

// ─── PRODUCTS ──────────────────────────────────────────────────────────────

export const listAdminProducts = async ({ search, categoryId, sellerId, isActive, minPrice, maxPrice, page = 1, limit = 15 }) => {
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { description: { $regex: search.trim(), $options: 'i' } }
    ];
  }
  if (categoryId) query.categoryId = categoryId;
  if (sellerId) query.sellerId = sellerId;

  if (isActive === 'true') query.isActive = true;
  else if (isActive === 'false') query.isActive = false;
  // 'all' or undefined → no filter

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('categoryId', 'name')
      .populate('sellerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(query)
  ]);

  return { products, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
};

export const setProductStatus = async (id, isActive) => {
  const product = await Product.findById(id);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }
  product.isActive = isActive;
  await product.save();
  return product.toObject();
};

// ─── ORDERS ────────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: []
};

export const listAdminOrders = async ({ search, status, paymentStatus, page = 1, limit = 15, dateFrom, dateTo }) => {
  const query = {};

  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  if (search) {
    query.$or = [
      { contactEmail: { $regex: search.trim(), $options: 'i' } },
      { 'shippingAddress.fullName': { $regex: search.trim(), $options: 'i' } }
    ];
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Order.countDocuments(query)
  ]);

  return { orders, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
};

export const getAdminOrderById = async (id) => {
  const order = await Order.findById(id).populate('userId', 'name email').lean();
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }
  return order;
};

export const adminUpdateOrderStatus = async (id, status, note) => {
  const order = await Order.findById(id);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid status transition from "${order.status}" to "${status}"`);
    err.statusCode = 400;
    throw err;
  }

  order.status = status;
  order.statusHistory.push({
    status,
    changedAt: new Date(),
    note: note || `Admin updated status from ${order.status} to ${status}`
  });
  await order.save();

  // Enqueue status email
  try {
    const { enqueueOrderStatusUpdate } = await import('../../queues/email.queue.js');
    await enqueueOrderStatusUpdate(order._id.toString());
  } catch (queueErr) {
    console.error('[Admin] Failed to enqueue order status email:', queueErr.message);
  }

  return order.toObject();
};

export const updateOrderShipping = async (id, shippingData) => {
  const order = await Order.findById(id);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (!order.shippingInfo) order.shippingInfo = {};
  Object.assign(order.shippingInfo, shippingData);
  await order.save();
  return order.toObject();
};

// ─── BANNERS ───────────────────────────────────────────────────────────────

export const listBanners = async () => {
  return Banner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
};

export const createBanner = async (data) => {
  return (await Banner.create(data)).toObject();
};

export const updateBanner = async (id, data) => {
  const banner = await Banner.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!banner) {
    const err = new Error('Banner not found');
    err.statusCode = 404;
    throw err;
  }
  return banner.toObject();
};

export const setBannerStatus = async (id, isActive) => {
  const banner = await Banner.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!banner) {
    const err = new Error('Banner not found');
    err.statusCode = 404;
    throw err;
  }
  return banner.toObject();
};

export const deleteBanner = async (id) => {
  const banner = await Banner.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!banner) {
    const err = new Error('Banner not found');
    err.statusCode = 404;
    throw err;
  }
  return banner.toObject();
};

export const uploadBannerImage = async (file) => {
  if (!file) {
    const err = new Error('No file uploaded');
    err.statusCode = 400;
    throw err;
  }
  const url = await uploadImage(file.buffer, file.originalname);
  return url;
};
