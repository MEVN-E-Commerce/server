import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  priceAtAdd: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
    index: true
  },
  guestSessionId: {
    type: String,
    sparse: true,
    index: true
  },
  items: {
    type: [cartItemSchema],
    default: []
  }
}, {
  timestamps: true
});

// Enforce that exactly one of userId/guestSessionId must be set
cartSchema.pre('validate', function(next) {
  const hasUser = this.userId != null;
  const hasGuest = this.guestSessionId != null && this.guestSessionId !== '';
  if (hasUser && hasGuest) {
    this.invalidate('userId', 'Cannot set both userId and guestSessionId');
    this.invalidate('guestSessionId', 'Cannot set both userId and guestSessionId');
    const err = new Error('Cart must have exactly one of userId or guestSessionId');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (!hasUser && !hasGuest) {
    this.invalidate('userId', 'Must set either userId or guestSessionId');
    this.invalidate('guestSessionId', 'Must set either userId or guestSessionId');
    const err = new Error('Cart must have exactly one of userId or guestSessionId');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (typeof next === 'function') next();
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
