import mongoose from 'mongoose';
import { ORDER_STATUS, PAYMENT_STATUS } from './constants.js';

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  guestEmail: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: [val => val && val.length > 0, 'Order must contain at least one item']
  },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.UNPAID
  },
  paymentMethod: {
    type: String,
    required: true,
    default: 'stripe'
  },
  stripeSessionId: {
    type: String,
    index: true,
    sparse: true
  },
  shippingAddress: {
    fullName: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  promoCode: {
    type: String,
    default: null
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  shipping: {
    type: Number,
    required: true,
    default: 0
  },
  tax: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: Object.values(ORDER_STATUS),
        required: true
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      note: {
        type: String,
        default: ''
      }
    }
  ]
}, {
  timestamps: true
});

// Enforce that exactly one of userId/guestEmail is set
orderSchema.pre('validate', function(next) {
  const hasUser = this.userId != null;
  const hasGuest = this.guestEmail != null && this.guestEmail !== '';
  if (hasUser && hasGuest) {
    this.invalidate('userId', 'Cannot set both userId and guestEmail');
    this.invalidate('guestEmail', 'Cannot set both userId and guestEmail');
    const err = new Error('Order must have exactly one of userId or guestEmail');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (!hasUser && !hasGuest) {
    this.invalidate('userId', 'Must set either userId or guestEmail');
    this.invalidate('guestEmail', 'Must set either userId or guestEmail');
    const err = new Error('Order must have exactly one of userId or guestEmail');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (typeof next === 'function') next();
});

const Order = mongoose.model('Order', orderSchema);

export default Order;
