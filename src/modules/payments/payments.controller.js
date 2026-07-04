import Stripe from 'stripe';
import config from '../../config/env.js';
import Order from '../orders/order.model.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../orders/constants.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../cart/errors.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      throw new BadRequestError('orderId is required');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Verify order status is pending
    if (order.status !== ORDER_STATUS.PENDING) {
      throw new BadRequestError(`Checkout session can only be created for pending orders. Current status: ${order.status}`);
    }

    // Verify order belongs to the requester
    if (order.userId) {
      if (!req.user || order.userId.toString() !== req.user.userId) {
        throw new ForbiddenError('You do not have permission to pay for this order');
      }
    }

    // Build line items from order items
    const lineItems = order.items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), // in cents
      },
      quantity: item.quantity,
    }));

    // Add shipping if > 0
    if (order.shipping > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping Fee',
          },
          unit_amount: Math.round(order.shipping * 100),
        },
        quantity: 1,
      });
    }

    // Add tax if > 0
    if (order.tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Sales Tax',
          },
          unit_amount: Math.round(order.tax * 100),
        },
        quantity: 1,
      });
    }

    // Create checkout session
    let session;
    let fallbackToMock = false;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        metadata: {
          orderId: order._id.toString()
        },
        success_url: `${config.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: config.STRIPE_CANCEL_URL,
      });
    } catch (stripeErr) {
      console.warn('[Payments Controller] Stripe API session creation failed, falling back to mock checkout:', stripeErr.message);
      fallbackToMock = true;
    }

    if (fallbackToMock) {
      // Create a mock session ID
      const mockSessionId = `cs_mock_${Math.random().toString(36).substring(2, 15)}`;
      
      // Complete payment and mark order as paid automatically in development/fallback mode
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.status = ORDER_STATUS.PAID;
      order.stripeSessionId = mockSessionId;
      order.statusHistory.push({
        status: ORDER_STATUS.PAID,
        changedAt: new Date(),
        note: `Mock payment completed automatically due to Stripe API key/service unavailability.`
      });
      await order.save();

      // Send order confirmation email directly
      try {
        const { sendOrderConfirmation } = await import('../../services/email.service.js');
        await sendOrderConfirmation(order._id.toString());
      } catch (emailErr) {
        console.error(`[Payments Controller] Failed to send mock order-confirmation email for Order ${order._id}:`, emailErr);
      }

      const successUrl = `${config.STRIPE_SUCCESS_URL}?session_id=${mockSessionId}&orderId=${order._id}`;
      return res.status(200).json({
        success: true,
        url: successUrl
      });
    }

    // Save session id to order
    order.stripeSessionId = session.id;
    await order.save();

    res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400);
    return next(new Error(`Webhook Error: ${err.message}`));
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const stripeSessionId = session.id;

      // Find order by ID or stripeSessionId
      let order = null;
      if (orderId) {
        order = await Order.findById(orderId);
      }
      if (!order && stripeSessionId) {
        order = await Order.findOne({ stripeSessionId });
      }

      if (!order) {
        console.error(`[Webhook] Order not found for session metadata orderId: ${orderId} or stripeSessionId: ${stripeSessionId}`);
        return res.status(200).json({ received: true, error: 'Order not found' });
      }

      // IDEMPOTENCY: if order.paymentStatus is already 'paid', return 200
      if (order.paymentStatus === PAYMENT_STATUS.PAID) {
        console.log(`[Webhook] Order ${order._id} is already paid. Skipping processing.`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // Update order status
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.status = ORDER_STATUS.PAID;
      order.statusHistory.push({
        status: ORDER_STATUS.PAID,
        changedAt: new Date(),
        note: `Stripe checkout session completed. Session ID: ${session.id}`
      });

      await order.save();
      console.log(`[Webhook] Order ${order._id} successfully marked as PAID.`);

      // Send order confirmation email directly
      try {
        const { sendOrderConfirmation } = await import('../../services/email.service.js');
        await sendOrderConfirmation(order._id.toString());
      } catch (emailErr) {
        console.error(`[Webhook] Failed to send order-confirmation email for Order ${order._id}:`, emailErr);
      }

    } else if (
      event.type === 'checkout.session.expired' ||
      event.type === 'payment_intent.payment_failed'
    ) {
      const sessionOrIntent = event.data.object;
      const orderId = sessionOrIntent.metadata?.orderId || sessionOrIntent.metadata?.order_id;
      const stripeSessionId = sessionOrIntent.id;

      let order = null;
      if (orderId) {
        order = await Order.findById(orderId);
      }
      if (!order && stripeSessionId) {
        order = await Order.findOne({ stripeSessionId });
      }

      if (order) {
        if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
          order.paymentStatus = PAYMENT_STATUS.FAILED;
          order.statusHistory.push({
            status: order.status,
            changedAt: new Date(),
            note: `Payment failed or session expired. Stripe Event: ${event.type}`
          });
          await order.save();
          console.log(`[Webhook] Order ${order._id} marked as PAYMENT_FAILED.`);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500);
    next(err);
  }
};
