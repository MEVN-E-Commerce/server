import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// 1. Register ES Modules mocks BEFORE importing the app or models
jest.unstable_mockModule('../src/queues/email.queue.js', () => {
  return {
    enqueueOrderConfirmation: jest.fn().mockResolvedValue(true),
    enqueueOrderStatusUpdate: jest.fn().mockResolvedValue(true)
  };
});

jest.unstable_mockModule('stripe', () => {
  const mockStripeInstance = {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_mocksessionid',
          url: 'https://checkout.stripe.com/pay/cs_test_mocksessionid'
        })
      }
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation((body, sig, secret) => {
        // Simply return the parsed body for testing webhook handlers
        return Buffer.isBuffer(body) ? JSON.parse(body.toString()) : body;
      })
    }
  };

  const mockStripeClass = jest.fn().mockImplementation(() => mockStripeInstance);
  // Also attach webhooks to the class directly for static access if needed
  mockStripeClass.webhooks = mockStripeInstance.webhooks;

  return {
    default: mockStripeClass
  };
});

// 2. Import modules dynamically using top-level await so mocks are applied
const { default: request } = await import('supertest');
const { default: mongoose } = await import('mongoose');
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Cart } = await import('../src/modules/cart/cart.model.js');
const { default: Order } = await import('../src/modules/orders/order.model.js');
const { ORDER_STATUS, PAYMENT_STATUS } = await import('../src/modules/orders/constants.js');
const emailQueue = await import('../src/queues/email.queue.js');
const { default: jwt } = await import('jsonwebtoken');
const { default: config } = await import('../src/config/env.js');

// Test database URI
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/mevn-marketplace-test';

describe('MEVN Marketplace Server Integration Tests', () => {
  let dbConnection;
  let customerUser, sellerUser, adminUser;
  let customerToken, sellerToken, adminToken;
  let testCategory, testProduct;

  beforeAll(async () => {
    // Connect to test database
    dbConnection = await mongoose.connect(TEST_MONGO_URI);
  });

  afterAll(async () => {
    // Clean database and disconnect
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});

    // Reset mocks
    jest.clearAllMocks();

    // Seed test users
    customerUser = await User.create({
      name: 'Customer Test',
      email: 'customer@test.com',
      passwordHash: 'dummyhash',
      role: 'customer',
      isVerified: true
    });
    customerToken = jwt.sign({ userId: customerUser._id, role: 'customer' }, config.JWT_SECRET);

    sellerUser = await User.create({
      name: 'Seller Test',
      email: 'seller@test.com',
      passwordHash: 'dummyhash',
      role: 'seller',
      isVerified: true
    });
    sellerToken = jwt.sign({ userId: sellerUser._id, role: 'seller' }, config.JWT_SECRET);

    adminUser = await User.create({
      name: 'Admin Test',
      email: 'admin@test.com',
      passwordHash: 'dummyhash',
      role: 'admin',
      isVerified: true
    });
    adminToken = jwt.sign({ userId: adminUser._id, role: 'admin' }, config.JWT_SECRET);

    // Seed category and product
    testCategory = await Category.create({
      name: 'Electronics',
      description: 'Gadgets and electronics'
    });

    testProduct = await Product.create({
      sellerId: sellerUser._id,
      name: 'Laptop X',
      description: 'Powerful developer laptop',
      price: 1000.00,
      categoryId: testCategory._id,
      stock: 10,
      isActive: true
    });
  });

  // ==========================================
  // TEST 1: Cart Add/Remove/Quantity-Clamp-On-Stock
  // ==========================================
  describe('Cart Module', () => {
    it('should add, update quantity, and remove items from the cart', async () => {
      // 1. Add item to cart
      let res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].productId._id).toBe(testProduct._id.toString());
      expect(res.body.cart.items[0].quantity).toBe(2);
      expect(res.body.cart.subtotal).toBe(2000.00);

      // 2. Fail when quantity exceeds stock
      res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 15 }); // 2 + 15 = 17 > 10 stock

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Insufficient stock available');

      // 3. Update quantity
      res = await request(app)
        .patch(`/api/v1/cart/items/${testProduct._id.toString()}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(5);

      // 4. Update quantity to 0 deletes the line
      res = await request(app)
        .patch(`/api/v1/cart/items/${testProduct._id.toString()}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 0 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(0);

      // 5. Add back and remove item
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 1 });

      res = await request(app)
        .delete(`/api/v1/cart/items/${testProduct._id.toString()}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(0);
    });
  });

  // ==========================================
  // TEST 2: Order Placement Happy Path
  // ==========================================
  describe('Order Placement - Happy Path', () => {
    it('should successfully place an order and decrement stock', async () => {
      // 1. Add item to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 2 });

      // 2. Place order
      const shippingAddress = {
        fullName: 'Jane Doe',
        line1: '123 Main St',
        city: 'Cairo',
        country: 'Egypt',
        postalCode: '11511',
        phone: '01000000000'
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.order.status).toBe(ORDER_STATUS.PENDING);
      expect(res.body.order.paymentStatus).toBe(PAYMENT_STATUS.UNPAID);
      expect(res.body.order.items[0].productId).toBe(testProduct._id.toString());
      expect(res.body.order.items[0].quantity).toBe(2);

      // Total details check: subtotal=2000, shipping=0 (free over 100), tax=160 (8%), total=2160
      expect(res.body.order.subtotal).toBe(2000.00);
      expect(res.body.order.shipping).toBe(0.00);
      expect(res.body.order.tax).toBe(160.00);
      expect(res.body.order.total).toBe(2160.00);

      // Verify stock is decremented atomically
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stock).toBe(8); // 10 - 2 = 8

      // Verify cart is cleared
      const cart = await Cart.findOne({ userId: customerUser._id });
      expect(cart.items).toHaveLength(0);
    });
  });

  // ==========================================
  // TEST 3: Order Placement with Insufficient Stock (409 and NOT decrement)
  // ==========================================
  describe('Order Placement - Insufficient Stock', () => {
    it('should reject checkout if stock becomes insufficient and not change stock', async () => {
      // 1. Add item to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 5 });

      // 2. Reduce product stock concurrently to 3 (below cart quantity of 5)
      await Product.findByIdAndUpdate(testProduct._id, { stock: 3 });

      // 3. Place order
      const shippingAddress = {
        fullName: 'Jane Doe',
        line1: '123 Main St',
        city: 'Cairo',
        country: 'Egypt',
        postalCode: '11511',
        phone: '01000000000'
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].productId).toBe(testProduct._id.toString());
      expect(res.body.errors[0].reason).toContain('Insufficient stock');

      // Verify product stock is NOT decremented (remains 3)
      const freshProduct = await Product.findById(testProduct._id);
      expect(freshProduct.stock).toBe(3);

      // Verify cart is NOT cleared
      const cart = await Cart.findOne({ userId: customerUser._id });
      expect(cart.items).toHaveLength(1);
    });
  });

  // ==========================================
  // TEST 4: Concurrent Order Placement on Last Unit (Race Condition Test)
  // ==========================================
  describe('Order Placement - Concurrency/Race Condition', () => {
    it('should only allow one of the concurrent checkouts to succeed for the last unit in stock', async () => {
      // 1. Set product stock to exactly 1
      await Product.findByIdAndUpdate(testProduct._id, { stock: 1 });

      // 2. Create another user for concurrent request
      const buyerB = await User.create({
        name: 'Buyer B',
        email: 'buyerb@test.com',
        passwordHash: 'dummyhash',
        role: 'customer',
        isVerified: true
      });
      const buyerBToken = jwt.sign({ userId: buyerB._id, role: 'customer' }, config.JWT_SECRET);

      // 3. Populate carts for both users with 1 item each
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 1 });

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerBToken}`)
        .send({ productId: testProduct._id.toString(), quantity: 1 });

      // 4. Fire concurrent checkout requests
      const shippingAddress = {
        fullName: 'Concurrency Test',
        line1: '123 Main St',
        city: 'Cairo',
        country: 'Egypt',
        postalCode: '11511',
        phone: '01000000000'
      };

      const requestA = request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddress });

      const requestB = request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerBToken}`)
        .send({ shippingAddress });

      const [resA, resB] = await Promise.all([requestA, requestB]);

      // 5. Verify exactly one succeeded (201) and one failed (409)
      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      // Verify product stock is exactly 0 and never went negative
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stock).toBe(0);
    });
  });

  // ==========================================
  // TEST 5: Webhook Idempotency (Duplicate completed webhook ignored)
  // ==========================================
  describe('Stripe Webhook - Idempotency', () => {
    it('should be safe to call checkout.session.completed twice without duplicate processing or duplicate email jobs', async () => {
      // 1. Create a mock order
      const order = await Order.create({
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
          fullName: 'Jane Doe',
          line1: '123 Main St',
          city: 'Cairo',
          country: 'Egypt',
          postalCode: '11511',
          phone: '01000000000'
        },
        contactEmail: 'customer@test.com',
        subtotal: testProduct.price,
        shipping: 10,
        tax: 80,
        total: 1090,
        stripeSessionId: 'cs_test_idempotency_123',
        statusHistory: [{ status: ORDER_STATUS.PENDING, changedAt: new Date(), note: 'Placed' }]
      });

      // Mock webhook event payload
      const stripeEventPayload = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_idempotency_123',
            metadata: {
              orderId: order._id.toString()
            }
          }
        }
      };

      // 2. Call the Stripe webhook first time
      let res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'valid_mock_signature')
        .send(stripeEventPayload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.duplicate).toBeUndefined();

      // Check order status changed to paid
      let freshOrder = await Order.findById(order._id);
      expect(freshOrder.paymentStatus).toBe(PAYMENT_STATUS.PAID);
      expect(freshOrder.status).toBe(ORDER_STATUS.PAID);

      // Verify email job is enqueued
      expect(emailQueue.enqueueOrderConfirmation).toHaveBeenCalledTimes(1);
      expect(emailQueue.enqueueOrderConfirmation).toHaveBeenCalledWith(order._id.toString());

      // Clear spy call counter before second run
      emailQueue.enqueueOrderConfirmation.mockClear();

      // 3. Call webhook second time with identical event
      res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'valid_mock_signature')
        .send(stripeEventPayload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.duplicate).toBe(true); // Return duplicate: true immediately

      // Verify NO email confirmation is enqueued again
      expect(emailQueue.enqueueOrderConfirmation).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // TEST 6: Illegal Status Transition Rejected
  // ==========================================
  describe('Order Status Transitions - Constraints', () => {
    it('should reject invalid status transitions (e.g., delivered -> pending)', async () => {
      // 1. Create a delivered order
      const order = await Order.create({
        userId: customerUser._id,
        items: [{
          productId: testProduct._id,
          sellerId: sellerUser._id,
          name: testProduct.name,
          quantity: 1,
          price: testProduct.price,
          subtotal: testProduct.price
        }],
        status: ORDER_STATUS.DELIVERED,
        paymentStatus: PAYMENT_STATUS.PAID,
        paymentMethod: 'stripe',
        shippingAddress: {
          fullName: 'Jane Doe',
          line1: '123 Main St',
          city: 'Cairo',
          country: 'Egypt',
          postalCode: '11511',
          phone: '01000000000'
        },
        contactEmail: 'customer@test.com',
        subtotal: testProduct.price,
        shipping: 10,
        tax: 80,
        total: 1090,
        statusHistory: [
          { status: ORDER_STATUS.PENDING, changedAt: new Date(), note: 'Placed' },
          { status: ORDER_STATUS.PAID, changedAt: new Date(), note: 'Paid' },
          { status: ORDER_STATUS.PROCESSING, changedAt: new Date(), note: 'Processing' },
          { status: ORDER_STATUS.SHIPPED, changedAt: new Date(), note: 'Shipped' },
          { status: ORDER_STATUS.DELIVERED, changedAt: new Date(), note: 'Delivered' }
        ]
      });

      // 2. Admin tries to transition delivered -> pending
      const res = await request(app)
        .patch(`/api/v1/orders/${order._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ORDER_STATUS.PENDING, note: 'Attempting illegal reset' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid status transition');

      // Verify order status did not change
      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.status).toBe(ORDER_STATUS.DELIVERED);
    });
  });
});
