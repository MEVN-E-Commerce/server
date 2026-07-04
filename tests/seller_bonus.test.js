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
const { default: Seller } = await import('../src/models/Seller.js');
const { default: PromoCode } = await import('../src/models/PromoCode.js');
const { default: Review } = await import('../src/models/Review.js');
const { default: Loyalty } = await import('../src/models/Loyalty.js');
const { ORDER_STATUS } = await import('../src/modules/orders/constants.js');
const { default: jwt } = await import('jsonwebtoken');
const { default: config } = await import('../src/config/env.js');

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/mevn-marketplace-test';

describe('Seller and Bonus Modules Integration Tests', () => {
  let dbConnection;
  let customerUser, sellerUser, adminUser;
  let customerToken, sellerToken, adminToken;
  let testCategory, testProduct, testPromoCode;

  beforeAll(async () => {
    dbConnection = await mongoose.connect(TEST_MONGO_URI);
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({});
    await Seller.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await PromoCode.deleteMany({});
    await Review.deleteMany({});
    await Loyalty.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Seller.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await PromoCode.deleteMany({});
    await Review.deleteMany({});
    await Loyalty.deleteMany({});

    // Create users
    customerUser = await User.create({
      name: 'Customer Joe',
      email: 'joe@example.com',
      passwordHash: 'hashedpassword',
      role: 'customer',
      isVerified: true
    });

    sellerUser = await User.create({
      name: 'Seller Sam',
      email: 'sam@example.com',
      passwordHash: 'hashedpassword',
      role: 'seller',
      sellerStatus: 'approved',
      isVerified: true
    });

    adminUser = await User.create({
      name: 'Admin Alice',
      email: 'alice@example.com',
      passwordHash: 'hashedpassword',
      role: 'admin',
      isVerified: true
    });

    customerToken = jwt.sign({ userId: customerUser._id.toString(), role: 'customer' }, config.JWT_SECRET);
    sellerToken = jwt.sign({ userId: sellerUser._id.toString(), role: 'seller' }, config.JWT_SECRET);
    adminToken = jwt.sign({ userId: adminUser._id.toString(), role: 'admin' }, config.JWT_SECRET);

    // Create seller profile for sam
    await Seller.create({
      userId: sellerUser._id,
      storeName: 'Sam Store',
      description: 'Sam store description',
      status: 'approved'
    });

    // Create category and product
    testCategory = await Category.create({ name: 'Electronics', description: 'Gadgets' });
    testProduct = await Product.create({
      sellerId: sellerUser._id,
      name: 'Smart Watch',
      price: 150,
      categoryId: testCategory._id,
      stock: 20,
      isActive: true
    });

    // Create promo code
    testPromoCode = await PromoCode.create({
      code: 'WELCOME10',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 50,
      isActive: true
    });
  });

  // ─── SELLER REGISTRATION & PROFILE ─────────────────────────────────────────
  describe('Seller Registration Flow', () => {
    it('should allow customer to register as seller (returns pending status)', async () => {
      const res = await request(app)
        .post('/api/v1/sellers/register')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          storeName: 'Super Gadget Store',
          description: 'A great store',
          phone: '1234567890',
          address: '123 Main St',
          payoutInfo: 'payout-123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.seller.status).toBe('pending');

      const updatedUser = await User.findById(customerUser._id);
      expect(updatedUser.role).toBe('seller');
      expect(updatedUser.sellerStatus).toBe('pending');
    });

    it('should prevent registration with duplicate store name', async () => {
      const res = await request(app)
        .post('/api/v1/sellers/register')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          storeName: 'Sam Store',
          description: 'A great store'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Store name is already taken');
    });

    it('should retrieve and update seller profile details', async () => {
      const getRes = await request(app)
        .get('/api/v1/sellers/profile')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.seller.storeName).toBe('Sam Store');

      const updateRes = await request(app)
        .put('/api/v1/sellers/profile')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          description: 'New Description',
          phone: '555-555'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.seller.description).toBe('New Description');
      expect(updateRes.body.seller.phone).toBe('555-555');
    });
  });

  // ─── SELLER PRODUCT & STOCK MANAGEMENT ─────────────────────────────────────
  describe('Seller Product Management', () => {
    it('should list products belonging to the seller', async () => {
      const res = await request(app)
        .get('/api/v1/sellers/products')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].name).toBe('Smart Watch');
    });

    it('should allow seller to update stock/inventory of their own product', async () => {
      const res = await request(app)
        .patch(`/api/v1/sellers/products/${testProduct._id.toString()}/stock`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ stock: 50 });

      expect(res.status).toBe(200);
      expect(res.body.product.stock).toBe(50);
    });

    it('should prevent seller from updating stock of another seller\'s product', async () => {
      const otherSeller = await User.create({
        name: 'Other Seller',
        email: 'other@example.com',
        passwordHash: 'hash',
        role: 'seller',
        sellerStatus: 'approved'
      });
      const otherToken = jwt.sign({ userId: otherSeller._id.toString(), role: 'seller' }, config.JWT_SECRET);

      const res = await request(app)
        .patch(`/api/v1/sellers/products/${testProduct._id.toString()}/stock`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ stock: 50 });

      expect(res.status).toBe(403);
    });
  });

  // ─── SELLER ORDER QUEUE ────────────────────────────────────────────────────
  describe('Seller Order Queue', () => {
    let order;
    beforeEach(async () => {
      order = await Order.create({
        userId: customerUser._id,
        items: [{
          productId: testProduct._id,
          sellerId: sellerUser._id,
          name: 'Smart Watch',
          quantity: 1,
          price: 150,
          subtotal: 150
        }],
        shippingAddress: {
          fullName: 'Joe Customer',
          line1: '123 Test St',
          city: 'Cairo',
          country: 'Egypt',
          postalCode: '11511',
          phone: '12345678'
        },
        contactEmail: 'joe@example.com',
        subtotal: 150,
        shipping: 0,
        tax: 12,
        total: 162,
        status: ORDER_STATUS.PAID,
        paymentStatus: 'paid',
        paymentMethod: 'stripe',
        statusHistory: [{ status: ORDER_STATUS.PAID, changedAt: new Date(), note: 'Paid' }]
      });
    });

    it('should retrieve orders containing seller\'s products', async () => {
      const res = await request(app)
        .get('/api/v1/sellers/orders')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders.length).toBe(1);
    });

    it('should update status of the order to processing / shipped / delivered', async () => {
      const res = await request(app)
        .patch(`/api/v1/sellers/orders/${order._id.toString()}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'processing' });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('processing');
    });

    it('should deny status update from seller who does not own items in the order', async () => {
      const otherSeller = await User.create({
        name: 'Other Seller',
        email: 'other@example.com',
        passwordHash: 'hash',
        role: 'seller',
        sellerStatus: 'approved'
      });
      const otherToken = jwt.sign({ userId: otherSeller._id.toString(), role: 'seller' }, config.JWT_SECRET);

      const res = await request(app)
        .patch(`/api/v1/sellers/orders/${order._id.toString()}/status`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ status: 'processing' });

      expect(res.status).toBe(403);
    });
  });

  // ─── PROMO CODES ───────────────────────────────────────────────────────────
  describe('Promo Codes CRUD & Validation', () => {
    it('should allow admin to create and list promo codes', async () => {
      const createRes = await request(app)
        .post('/api/v1/bonus/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DISCOUNT20',
          discountType: 'fixed',
          discountValue: 20,
          minOrderAmount: 100,
          isActive: true
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.promoCode.code).toBe('DISCOUNT20');

      const listRes = await request(app)
        .get('/api/v1/bonus/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.promoCodes.length).toBe(2); // WELCOME10 and DISCOUNT20
    });

    it('should validate promo code discount computation during validation endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/bonus/promo-codes/${testPromoCode.code}/validate?subtotal=100`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.discount).toBe(10); // 10% of 100
    });
  });

  // ─── REVIEWS & RATINGS ─────────────────────────────────────────────────────
  describe('Reviews and Ratings', () => {
    it('should allow customer to create review and update product aggregate rating', async () => {
      const res = await request(app)
        .post('/api/v1/bonus/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId: testProduct._id.toString(),
          rating: 5,
          comment: 'Outstanding product!'
        });

      expect(res.status).toBe(201);
      expect(res.body.review.rating).toBe(5);

      const product = await Product.findById(testProduct._id);
      expect(product.rating).toBe(5);
    });

    it('should enforce only one review per customer per product', async () => {
      await request(app)
        .post('/api/v1/bonus/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId: testProduct._id.toString(),
          rating: 4,
          comment: 'First review'
        });

      const secondRes = await request(app)
        .post('/api/v1/bonus/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId: testProduct._id.toString(),
          rating: 5,
          comment: 'Second review'
        });

      expect(secondRes.status).toBe(400);
    });
  });

  // ─── LOYALTY POINTS ────────────────────────────────────────────────────────
  describe('Loyalty Points System', () => {
    it('should retrieve loyalty points balance (default to 0)', async () => {
      const res = await request(app)
        .get('/api/v1/bonus/loyalty')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.points).toBe(0);
    });

    it('should apply promo code and earn loyalty points during checkout', async () => {
      const { default: Cart } = await import('../src/modules/cart/cart.model.js');
      
      // Populate cart
      await Cart.create({
        userId: customerUser._id,
        items: [{ productId: testProduct._id, quantity: 1, priceAtAdd: testProduct.price }]
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            fullName: 'Joe Customer',
            line1: '123 Test St',
            city: 'Cairo',
            country: 'Egypt',
            postalCode: '11511',
            phone: '12345678'
          },
          promoCode: 'WELCOME10'
        });

      expect(res.status).toBe(201);
      expect(res.body.order.promoCode).toBe('WELCOME10');
      // Subtotal = 150. Tax = 12. Shipping = 0. Total = 162.
      // 10% discount on 150 = 15. New total = 162 - 15 = 147.
      expect(res.body.order.total).toBe(147);

      // Verify points earned (147 / 10 = 14 points)
      const loyaltyRes = await request(app)
        .get('/api/v1/bonus/loyalty')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(loyaltyRes.body.points).toBe(14);
    });

    it('should redeem loyalty points during checkout', async () => {
      const { default: Cart } = await import('../src/modules/cart/cart.model.js');
      
      // Pre-seed user with 50 loyalty points ($5 discount)
      await Loyalty.create({ userId: customerUser._id, points: 50 });

      // Populate cart
      await Cart.create({
        userId: customerUser._id,
        items: [{ productId: testProduct._id, quantity: 1, priceAtAdd: testProduct.price }]
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            fullName: 'Joe Customer',
            line1: '123 Test St',
            city: 'Cairo',
            country: 'Egypt',
            postalCode: '11511',
            phone: '12345678'
          },
          redeemPoints: true
        });

      expect(res.status).toBe(201);
      // Subtotal = 150. Tax = 12. Total = 162.
      // 50 points redeemed = $5.00 discount. New total = 162 - 5 = 157.
      // Plus they earn points on 157 (15 points).
      expect(res.body.order.total).toBe(157);

      // Verify points balance: 50 points redeemed, then 15 earned -> 15 points.
      const loyaltyRes = await request(app)
        .get('/api/v1/bonus/loyalty')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(loyaltyRes.body.points).toBe(15);
    });
  });
});
