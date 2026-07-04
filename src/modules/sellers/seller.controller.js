import Seller from '../../models/Seller.js';
import User from '../../models/User.js';
import Product from '../../models/Product.js';
import Order from '../orders/order.model.js';
import { ORDER_STATUS } from '../orders/constants.js';

// State machine for allowed order status transitions (from order.controller.js)
const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: []
};

export const registerSeller = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { storeName, description, logo, phone, address, payoutInfo } = req.body;

    const existingSeller = await Seller.findOne({ userId });
    if (existingSeller) {
      res.status(400);
      return next(new Error('User is already registered as a seller'));
    }

    const duplicateStore = await Seller.findOne({ storeName });
    if (duplicateStore) {
      res.status(400);
      return next(new Error('Store name is already taken'));
    }

    const seller = await Seller.create({
      userId,
      storeName,
      description,
      logo,
      phone,
      address,
      payoutInfo,
      status: 'pending'
    });

    // Update user role and status
    const user = await User.findById(userId);
    if (user) {
      if (user.role === 'customer') {
        user.role = 'seller';
      }
      user.sellerStatus = 'pending';
      await user.save();
    }

    res.status(201).json({
      success: true,
      message: 'Seller registration submitted successfully. Pending admin approval.',
      seller
    });
  } catch (err) {
    next(err);
  }
};

export const getSellerProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.userId });
    if (!seller) {
      res.status(404);
      return next(new Error('Seller profile not found'));
    }
    res.status(200).json({ success: true, seller });
  } catch (err) {
    next(err);
  }
};

export const updateSellerProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.userId });
    if (!seller) {
      res.status(404);
      return next(new Error('Seller profile not found'));
    }

    const { storeName, description, logo, phone, address, payoutInfo } = req.body;

    if (storeName && storeName !== seller.storeName) {
      const duplicateStore = await Seller.findOne({ storeName });
      if (duplicateStore) {
        res.status(400);
        return next(new Error('Store name is already taken'));
      }
      seller.storeName = storeName;
    }

    if (description !== undefined) seller.description = description;
    if (logo !== undefined) seller.logo = logo;
    if (phone !== undefined) seller.phone = phone;
    if (address !== undefined) seller.address = address;
    if (payoutInfo !== undefined) seller.payoutInfo = payoutInfo;

    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Seller profile updated successfully',
      seller
    });
  } catch (err) {
    next(err);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const sellerId = req.user.userId;

    const products = await Product.find({ sellerId });
    const productIds = products.map(p => p._id);

    // Get orders containing this seller's products
    const orders = await Order.find({ 'items.sellerId': sellerId });

    // Calculate total sales from paid/processing/shipped/delivered orders
    let totalSales = 0;
    let totalOrdersCount = 0;

    orders.forEach(order => {
      if (order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.PENDING) {
        order.items.forEach(item => {
          if (item.sellerId.toString() === sellerId.toString()) {
            totalSales += item.subtotal;
          }
        });
        totalOrdersCount++;
      }
    });

    const lowStockProducts = products.filter(p => p.stock <= 5);

    res.status(200).json({
      success: true,
      stats: {
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalOrders: totalOrdersCount,
        totalProducts: products.length,
        lowStockCount: lowStockProducts.length,
        lowStockProducts
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getSellerProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ sellerId: req.user.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
};

export const updateProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404);
      return next(new Error('Product not found'));
    }

    if (product.sellerId.toString() !== req.user.userId && req.user.role !== 'admin') {
      res.status(403);
      return next(new Error('Forbidden — you do not own this product'));
    }

    product.stock = stock;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product stock updated successfully',
      product
    });
  } catch (err) {
    next(err);
  }
};

export const getSellerOrders = async (req, res, next) => {
  try {
    const sellerId = req.user.userId;
    const orders = await Order.find({ 'items.sellerId': sellerId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
};

export const updateSellerOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const sellerId = req.user.userId;

    const order = await Order.findById(id);
    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }

    // Check if seller owns any product in this order
    const ownsAnyItem = order.items.some(item => item.sellerId.toString() === sellerId.toString());
    if (!ownsAnyItem && req.user.role !== 'admin') {
      res.status(403);
      return next(new Error('Forbidden — you do not own any products in this order'));
    }

    const currentStatus = order.status;
    if (currentStatus !== status) {
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(status)) {
        res.status(400);
        return next(new Error(`Invalid status transition from ${currentStatus} to ${status}`));
      }

      order.status = status;
      order.statusHistory.push({
        status,
        changedAt: new Date(),
        note: `Status updated to ${status} by seller`
      });

      await order.save();
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully by seller',
      order
    });
  } catch (err) {
    next(err);
  }
};
