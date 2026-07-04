import Order from './order.model.js';
import Cart from '../cart/cart.model.js';
import Product from '../../models/Product.js';
import User from '../../models/User.js';
import { ORDER_STATUS, PAYMENT_STATUS } from './constants.js';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../cart/errors.js';

// State machine for allowed order status transitions
const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: []
};

export const placeOrder = async (req, res, next) => {
  const completedUpdates = [];
  try {
    const { shippingAddress, contactEmail: reqContactEmail } = req.body;

    // 1. Resolve contact email and guest/user identity
    let contactEmail = reqContactEmail;
    let userId = null;
    let guestEmail = null;

    if (req.user) {
      userId = req.user.userId;
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      contactEmail = contactEmail || user.email;
    } else {
      guestEmail = contactEmail;
    }

    // 2. Load the cart (user or guest)
    const cartQuery = req.user ? { userId } : { guestSessionId: req.guestSessionId };
    const cart = await Cart.findOne(cartQuery).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    // 3. Re-validate every item against live Product data (active status & stock)
    const failingItems = [];
    const itemsToProcess = [];

    for (const item of cart.items) {
      const product = item.productId;
      if (!product) {
        failingItems.push({
          productId: item.productId ? item.productId._id : null,
          name: 'Deleted Product',
          reason: 'Product no longer exists'
        });
        continue;
      }

      if (!product.isActive) {
        failingItems.push({
          productId: product._id,
          name: product.name,
          reason: 'Product is not active'
        });
        continue;
      }

      if (product.stock < item.quantity) {
        failingItems.push({
          productId: product._id,
          name: product.name,
          reason: `Insufficient stock. Requested: ${item.quantity}, Available: ${product.stock}`
        });
        continue;
      }

      itemsToProcess.push({
        product,
        quantity: item.quantity
      });
    }

    if (failingItems.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Some items in your cart are no longer available or out of stock.',
        errors: failingItems
      });
    }

    // 4. Decrement Product.stock atomically to prevent concurrent checkout race conditions
    for (const item of itemsToProcess) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.product._id,
          stock: { $gte: item.quantity },
          isActive: true
        },
        {
          $inc: { stock: -item.quantity }
        },
        { new: true }
      );

      if (!updatedProduct) {
        // Concurrent update race condition detected!
        // Fetch current live stock for logging
        const freshProduct = await Product.findById(item.product._id);
        throw new ConflictError(`Insufficient stock for product "${item.product.name}" due to concurrent checkouts. Only ${freshProduct?.stock || 0} items left.`);
      }

      completedUpdates.push({
        productId: item.product._id,
        quantity: item.quantity
      });
    }

    // 5. Compute subtotal/shipping/tax/total server-side
    const orderItems = itemsToProcess.map(item => {
      const itemSubtotal = parseFloat((item.product.price * item.quantity).toFixed(2));
      return {
        productId: item.product._id,
        sellerId: item.product.sellerId,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        subtotal: itemSubtotal
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const shipping = subtotal >= 100 ? 0.00 : 10.00; // Free shipping over $100, else $10
    const tax = parseFloat((subtotal * 0.08).toFixed(2)); // 8% placeholder tax
    const total = parseFloat((subtotal + shipping + tax).toFixed(2));

    // 6. Create the Order
    const order = await Order.create({
      userId: userId || undefined,
      guestEmail: guestEmail || undefined,
      items: orderItems,
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      paymentMethod: 'stripe',
      shippingAddress,
      contactEmail,
      subtotal: parseFloat(subtotal.toFixed(2)),
      shipping,
      tax,
      total,
      statusHistory: [{ status: ORDER_STATUS.PENDING, changedAt: new Date(), note: 'Order placed' }]
    });

    // 7. Clear the cart
    cart.items = [];
    await cart.save();

    res.status(201).json({
      success: true,
      order
    });
  } catch (err) {
    // Rollback any stock updates completed during this transaction if an error occurred
    for (const update of completedUpdates) {
      await Product.findByIdAndUpdate(update.productId, {
        $inc: { stock: update.quantity }
      });
    }
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.userId };

    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      pagination: {
        total: totalOrders,
        page,
        limit,
        pages: Math.ceil(totalOrders / limit)
      },
      orders
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Owner or Admin only
    const isAdmin = req.user.role === 'admin';
    const isOwner = order.userId && order.userId.toString() === req.user.userId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenError('You do not have permission to view this order');
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const trackOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    const order = await Order.findById(id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // If order belongs to a logged-in user, check if this requester is the owner or an admin
    if (order.userId) {
      if (!req.user) {
        throw new ForbiddenError('Access denied. Please log in to view this order.');
      }
      const isAdmin = req.user.role === 'admin';
      const isOwner = order.userId.toString() === req.user.userId;
      if (!isAdmin && !isOwner) {
        throw new ForbiddenError('You do not have permission to view this order');
      }
    } else {
      // Guest order tracking: require email validation
      if (!email || email.trim().toLowerCase() !== order.contactEmail.toLowerCase()) {
        throw new ForbiddenError('Access denied. Invalid tracking email provided.');
      }
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const currentStatus = order.status;

    // Validate status transition against the state machine
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestError(`Invalid status transition from "${currentStatus}" to "${status}".`);
    }

    // Update order status
    order.status = status;
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      note: note || `Status updated from ${currentStatus} to ${status}`
    });

    await order.save();

    // Enqueue order status update email job
    try {
      const { enqueueOrderStatusUpdate } = await import('../../queues/email.queue.js');
      await enqueueOrderStatusUpdate(order._id.toString());
    } catch (queueErr) {
      console.error(`[Order Status Update] Failed to enqueue status-update email for Order ${order._id}:`, queueErr);
    }

    res.status(200).json({
      success: true,
      message: `Order status successfully updated to ${status}`,
      order
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
