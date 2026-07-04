import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// 1. Mock ES modules before importing dependent files
jest.unstable_mockModule('../src/queues/email.queue.js', () => {
  return {
    enqueueOrderConfirmation: jest.fn().mockResolvedValue(true),
    enqueueOrderStatusUpdate: jest.fn().mockResolvedValue(true)
  };
});

jest.unstable_mockModule('../src/utils/cloudinary.js', () => {
  const mockMulter = {
    single: () => (req, res, next) => {
      req.file = {
        buffer: Buffer.from('mockImageBuffer'),
        originalname: 'test_banner.jpg'
      };
      next();
    },
    array: () => (req, res, next) => {
      req.files = [
        {
          buffer: Buffer.from('mockImageBuffer'),
          originalname: 'product_image.jpg'
        }
      ];
      next();
    }
  };
  return {
    upload: mockMulter,
    uploadImage: jest.fn().mockResolvedValue('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600')
  };
});

// 2. Dynamically import modules to apply mocks
const { default: request } = await import('supertest');
const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Order } = await import('../src/modules/orders/order.model.js');
const { default: Banner } = await import('../src/models/Banner.js');
const { ORDER_STATUS, PAYMENT_STATUS } = await import('../src/modules/orders/constants.js');
const { default: jwt } = await import('jsonwebtoken');
const { default: config } = await import('../src/config/env.js');

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/mevn-marketplace-test';

describe('Admin Panel Module Integration Tests', () => {
  let dbConnection;
  let adminUser, customerUser, sellerUser;
  let adminToken, customerToken, sellerToken;
  let testCategory, testProduct, testOrder, testBanner;

  beforeAll(async () => {
    dbConnection = await mongoose.connect(TEST_MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Banner.deleteMany({});

    jest.clearAllMocks();

    // Create users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@mevn.com',
      passwordHash: 'hashedpassword',
      role: 'admin',
      isVerified: true
    });
    adminToken = jwt.sign({ userId: adminUser._id, role: 'admin' }, config.JWT_SECRET);

    customerUser = await User.create({
      name: 'Customer User',
      email: 'customer@mevn.com',
      passwordHash: 'hashedpassword',
      role: 'customer',
      isVerified: true
    });
    customerToken = jwt.sign({ userId: customerUser._id, role: 'customer' }, config.JWT_SECRET);

    sellerUser = await User.create({
      name: 'Seller User',
      email: 'seller@mevn.com',
      passwordHash: 'hashedpassword',
      role: 'seller',
      isVerified: true,
      sellerStatus: 'pending'
    });
    sellerToken = jwt.sign({ userId: sellerUser._id, role: 'seller' }, config.JWT_SECRET);

    // Create Category & Product
    testCategory = await Category.create({
      name: 'Electronics',
      description: 'Gadgets and hardware'
    });

    testProduct = await Product.create({
      sellerId: sellerUser._id,
      name: 'SuperPhone Pro',
      description: 'Flagship phone with outstanding cameras',
      price: 899.99,
      categoryId: testCategory._id,
      stock: 5,
      isActive: true
    });

    // Create Order
    testOrder = await Order.create({
      userId: customerUser._id,
      items: [{
        productId: testProduct._id,
        sellerId: sellerUser._id,
        name: testProduct.name,
        quantity: 1,
        price: testProduct.price,
        subtotal: testProduct.price
      }],
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      paymentMethod: 'stripe',
      shippingAddress: {
        fullName: 'Jane Customer',
        line1: '456 West Blvd',
        city: 'New York',
        country: 'USA',
        postalCode: '10001',
        phone: '1234567890'
      },
      contactEmail: 'customer@mevn.com',
      subtotal: testProduct.price,
      shipping: 10,
      tax: 72,
      total: 981.99,
      statusHistory: [{ status: ORDER_STATUS.PENDING, note: 'Order placed' }]
    });

    // Create Banner
    testBanner = await Banner.create({
      title: 'Summer Sale!',
      subtitle: 'Up to 50% off select hardware',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      link: '/products',
      sortOrder: 1,
      isActive: true
    });
  });

  // ─── SECTION 1: ROLE-BASED GATING ──────────────────────────────────────────
  describe('RBAC Route Protection', () => {
    it('should deny access to unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('should deny access to customers (Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should deny access to sellers (Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow access to admin users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── SECTION 2: ADMIN DASHBOARD STATS ──────────────────────────────────────
  describe('Dashboard Analytics Endpoint', () => {
    it('should return aggregated counts and lists for dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body.users.total).toBe(3); // admin, customer, seller
      expect(res.body.users.sellers).toBe(1);
      expect(res.body.users.customers).toBe(1);

      expect(res.body).toHaveProperty('products');
      expect(res.body.products.total).toBe(1);

      expect(res.body).toHaveProperty('orders');
      expect(res.body.orders.pending).toBe(1);

      expect(res.body).toHaveProperty('recentOrders');
      expect(res.body.recentOrders).toHaveLength(1);
      expect(res.body.recentOrders[0]._id).toBe(testOrder._id.toString());

      expect(res.body).toHaveProperty('recentUsers');
      expect(res.body.recentUsers.length).toBeGreaterThan(0);
    });
  });

  // ─── SECTION 3: USER MANAGEMENT ──────────────────────────────────────────
  describe('User Management Endpoints', () => {
    it('should list users with pagination, filters, and searches', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=Customer&role=customer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].name).toBe('Customer User');
      expect(res.body.total).toBe(1);
    });

    it('should retrieve a single user by ID without exposing password hash', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${customerUser._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Customer User');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for a non-existent user ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/admin/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should update user roles and toggle isActive status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${customerUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false, role: 'seller' });

      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);
      expect(res.body.user.role).toBe('seller');

      const updatedUser = await User.findById(customerUser._id);
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.role).toBe('seller');
    });

    it('should approve/restrict sellers', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${sellerUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sellerStatus: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.user.sellerStatus).toBe('approved');
    });

    it('should reject requests with invalid request bodies (Validator Gate)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${customerUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' }); // invalid role enum

      expect(res.status).toBe(422);
    });

    it('should not allow deactivating the admin account (lockout protection)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot deactivate an admin account');
    });
  });

  // ─── SECTION 4: PRODUCT MODERATION ─────────────────────────────────────────
  describe('Product Moderation Endpoints', () => {
    it('should list all products under administrative rules', async () => {
      const res = await request(app)
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].name).toBe('SuperPhone Pro');
    });

    it('should allow toggling a product active status (Soft Disable/Enable)', async () => {
      // 1. Disable product
      let res = await request(app)
        .patch(`/api/v1/admin/products/${testProduct._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.product.isActive).toBe(false);

      let updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.isActive).toBe(false);

      // 2. Re-enable product
      res = await request(app)
        .patch(`/api/v1/admin/products/${testProduct._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.product.isActive).toBe(true);
    });
  });

  // ─── SECTION 5: ORDER & SHIPPING MANAGEMENT ───────────────────────────────
  describe('Order & Shipping Management Endpoints', () => {
    it('should list all orders under administrative rules', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0]._id).toBe(testOrder._id.toString());
    });

    it('should fetch a single order details', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/orders/${testOrder._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order._id).toBe(testOrder._id.toString());
      expect(res.body.order.userId.name).toBe('Customer User');
    });

    it('should allow valid order status transitions', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${testOrder._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ORDER_STATUS.PAID, note: 'Customer cleared invoice' });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(ORDER_STATUS.PAID);
      expect(res.body.order.statusHistory.length).toBe(2);
    });

    it('should prevent invalid order status transitions', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${testOrder._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ORDER_STATUS.DELIVERED, note: 'Direct skip' }); // illegal jump from pending

      expect(res.status).toBe(400);
    });

    it('should successfully save shipping information', async () => {
      const shippingUpdates = {
        trackingNumber: 'TRACK998877',
        courier: 'FedEx Express',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Deliver to front desk reception'
      };

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${testOrder._id.toString()}/shipping`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shippingUpdates);

      expect(res.status).toBe(200);
      expect(res.body.order.shippingInfo.trackingNumber).toBe('TRACK998877');
      expect(res.body.order.shippingInfo.courier).toBe('FedEx Express');
    });
  });

  // ─── SECTION 6: BANNER CMS ─────────────────────────────────────────────────
  describe('Banner CMS Endpoints', () => {
    it('should list all banners sorted by sortOrder', async () => {
      const res = await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.banners).toHaveLength(1);
      expect(res.body.banners[0].title).toBe('Summer Sale!');
    });

    it('should create a new banner and store it', async () => {
      const payload = {
        title: 'New Winter Collection',
        subtitle: 'Warm layers now available',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
        link: '/categories/clothing',
        sortOrder: 2,
        isActive: true
      };

      const res = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.banner.title).toBe('New Winter Collection');
      expect(res.body.banner.sortOrder).toBe(2);

      const dbBanner = await Banner.findOne({ title: 'New Winter Collection' });
      expect(dbBanner).toBeDefined();
      expect(dbBanner.sortOrder).toBe(2);
    });

    it('should update an existing banner details', async () => {
      const payload = {
        title: 'Updated Summer Sale!',
        sortOrder: 5
      };

      const res = await request(app)
        .put(`/api/v1/admin/banners/${testBanner._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.banner.title).toBe('Updated Summer Sale!');
      expect(res.body.banner.sortOrder).toBe(5);
    });

    it('should toggle banner active status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/banners/${testBanner._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.banner.isActive).toBe(false);
    });

    it('should soft-delete a banner', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/banners/${testBanner._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const deletedBanner = await Banner.findById(testBanner._id);
      expect(deletedBanner.isActive).toBe(false);
    });

    it('should successfully upload a banner image file', async () => {
      const res = await request(app)
        .post('/api/v1/admin/banners/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('mockImageBuffer'), 'test_banner.jpg');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.imageUrl).toContain('unsplash.com');
    });
  });
});
