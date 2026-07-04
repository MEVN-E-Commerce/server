import Cart from './cart.model.js';
import Product from '../../models/Product.js';
import { NotFoundError, BadRequestError, ConflictError } from './errors.js';

// Helper to format the cart with computed totals and filtered active items
export const formatCart = (cart) => {
  const items = (cart.items || []).filter(item => item.productId != null);
  const subtotal = items.reduce((sum, item) => sum + (item.priceAtAdd * item.quantity), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    _id: cart._id,
    userId: cart.userId,
    guestSessionId: cart.guestSessionId,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    totalItems,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt
  };
};

// Helper to get cart query based on req
const getCartQuery = (req) => {
  if (req.user && req.user.userId) {
    return { userId: req.user.userId };
  }
  return { guestSessionId: req.guestSessionId };
};

export const getCart = async (req, res, next) => {
  try {
    const query = getCartQuery(req);
    let cart = await Cart.findOne(query).populate('items.productId');
    if (!cart) {
      cart = await Cart.create(query);
    }
    res.status(200).json({
      success: true,
      cart: formatCart(cart)
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const addItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const query = getCartQuery(req);

    // 1. Validate product exists, is active, and check stock
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    if (!product.isActive) {
      throw new BadRequestError('Product is not active');
    }
    if (product.stock === 0) {
      throw new BadRequestError('Product is out of stock');
    }

    // 2. Find or create cart
    let cart = await Cart.findOne(query);
    if (!cart) {
      cart = await Cart.create(query);
    }

    // 3. Check if product already in cart to calculate target quantity
    const existingItem = cart.items.find(item => item.productId.toString() === productId);
    const targetQty = (existingItem ? existingItem.quantity : 0) + quantity;

    if (targetQty > product.stock) {
      throw new ConflictError(`Insufficient stock available. Requested: ${targetQty}, Available: ${product.stock}`);
    }

    // 4. Update quantity and snapshot price
    if (existingItem) {
      existingItem.quantity = targetQty;
      existingItem.priceAtAdd = product.price; // Update to latest price when quantity changes
    } else {
      cart.items.push({
        productId,
        quantity,
        priceAtAdd: product.price
      });
    }

    await cart.save();
    await cart.populate('items.productId');

    res.status(200).json({
      success: true,
      cart: formatCart(cart)
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const updateItemQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const query = getCartQuery(req);

    let cart = await Cart.findOne(query);
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) {
      throw new NotFoundError('Product not found in cart');
    }

    if (quantity === 0) {
      // Remove item
      cart.items.splice(itemIndex, 1);
    } else {
      // Re-validate product & stock
      const product = await Product.findById(productId);
      if (!product) {
        throw new NotFoundError('Product not found');
      }
      if (!product.isActive) {
        throw new BadRequestError('Product is not active');
      }
      if (quantity > product.stock) {
        throw new ConflictError(`Insufficient stock available. Requested: ${quantity}, Available: ${product.stock}`);
      }

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].priceAtAdd = product.price; // Update to latest price
    }

    await cart.save();
    await cart.populate('items.productId');

    res.status(200).json({
      success: true,
      cart: formatCart(cart)
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const removeItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const query = getCartQuery(req);

    let cart = await Cart.findOne(query);
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    await cart.save();
    await cart.populate('items.productId');

    res.status(200).json({
      success: true,
      cart: formatCart(cart)
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const query = getCartQuery(req);
    let cart = await Cart.findOne(query);
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      cart: formatCart(cart)
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const mergeCarts = async (req, res, next) => {
  try {
    const { guestSessionId } = req.body;
    const userId = req.user.userId;

    // Load guest cart
    const guestCart = await Cart.findOne({ guestSessionId }).populate('items.productId');
    
    // Find or create user cart
    let userCart = await Cart.findOne({ userId });
    if (!userCart) {
      userCart = await Cart.create({ userId });
    }

    if (guestCart && guestCart.items.length > 0) {
      for (const guestItem of guestCart.items) {
        // Skip items where product was deleted/not found
        if (!guestItem.productId) continue;

        const product = guestItem.productId;
        const productIdStr = product._id.toString();

        if (!product.isActive) {
          throw new BadRequestError(`Product "${product.name}" is no longer active.`);
        }

        const userItem = userCart.items.find(item => item.productId.toString() === productIdStr);
        const mergedQty = (userItem ? userItem.quantity : 0) + guestItem.quantity;

        if (mergedQty > product.stock) {
          throw new ConflictError(`Insufficient stock for product "${product.name}". Required: ${mergedQty}, Available: ${product.stock}`);
        }

        if (userItem) {
          userItem.quantity = mergedQty;
          userItem.priceAtAdd = product.price;
        } else {
          userCart.items.push({
            productId: product._id,
            quantity: guestItem.quantity,
            priceAtAdd: product.price
          });
        }
      }

      await userCart.save();
      // Delete guest cart on successful merge
      await Cart.deleteOne({ guestSessionId });
    }

    await userCart.populate('items.productId');

    res.status(200).json({
      success: true,
      cart: formatCart(userCart)
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
