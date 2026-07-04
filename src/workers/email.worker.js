import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import { Worker } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import Order from '../modules/orders/order.model.js';
import nodemailer from 'nodemailer';

// Connect to MongoDB database
connectDB();

// Setup Nodemailer transporter
let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  console.log('[Email Worker] SMTP credentials not provided. Falling back to console-logging mock transporter.');
}

const sendEmail = async (mailOptions) => {
  if (!transporter) {
    console.log('\n=======================================');
    console.log('         MOCK EMAIL LOGGED (STDOUT)     ');
    console.log('=======================================');
    console.log(`From:    ${mailOptions.from}`);
    console.log(`To:      ${mailOptions.to}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('---------------------------------------');
    console.log('HTML Body:');
    console.log(mailOptions.html);
    console.log('=======================================\n');
    return { messageId: 'mock-email-id-' + Date.now() };
  }
  return transporter.sendMail(mailOptions);
};

// Create Worker
const worker = new Worker(
  'emails',
  async (job) => {
    const { orderId } = job.data;
    console.log(`[Email Worker] Processing job '${job.name}' (id: ${job.id}) for Order ID: ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found in database.`);
    }

    let subject = '';
    let html = '';

    if (job.name === 'order-confirmation') {
      subject = `Order Confirmation - #${order._id}`;
      
      const itemsHtml = order.items.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.price.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.subtotal.toFixed(2)}</td>
        </tr>
      `).join('');

      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333; text-align: center; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Thank You for Your Order!</h2>
          <p>Dear Customer,</p>
          <p>Your order <strong>#${order._id}</strong> has been successfully placed. Here is a summary of your purchase:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 8px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; line-height: 1.6; margin-bottom: 20px; border-top: 1px dashed #eee; padding-top: 10px;">
            <p style="margin: 4px 0;">Subtotal: $${order.subtotal.toFixed(2)}</p>
            <p style="margin: 4px 0;">Shipping: $${order.shipping.toFixed(2)}</p>
            <p style="margin: 4px 0;">Tax (8%): $${order.tax.toFixed(2)}</p>
            <h3 style="color: #28a745; margin-top: 5px; font-size: 18px;">Total Paid: $${order.total.toFixed(2)}</h3>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h4 style="margin-top: 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Shipping Address:</h4>
            <p style="margin: 4px 0;"><strong>${order.shippingAddress.fullName}</strong></p>
            <p style="margin: 4px 0;">${order.shippingAddress.line1}${order.shippingAddress.line2 ? ', ' + order.shippingAddress.line2 : ''}</p>
            <p style="margin: 4px 0;">${order.shippingAddress.city}, ${order.shippingAddress.country} - ${order.shippingAddress.postalCode}</p>
            <p style="margin: 4px 0;">Phone: ${order.shippingAddress.phone}</p>
          </div>

          <p style="text-align: center; color: #777; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      `;
    } else if (job.name === 'order-status-update') {
      subject = `Order #${order._id} Status Update: ${order.status.toUpperCase()}`;

      const historyHtml = order.statusHistory.map(h => `
        <li style="margin-bottom: 8px;">
          <strong>${h.status.toUpperCase()}</strong> - ${new Date(h.changedAt).toLocaleString()}
          ${h.note ? `<br/><span style="color: #555; font-size: 13px;">Note: ${h.note}</span>` : ''}
        </li>
      `).reverse().join('');

      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Order Status Update</h2>
          <p>Dear Customer,</p>
          <p>The status of your order <strong>#${order._id}</strong> has been updated.</p>
          
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;">Current Status: <span style="font-weight: bold; color: #007bff; text-transform: uppercase;">${order.status}</span></p>
          </div>

          <h3>Order History Log:</h3>
          <ul style="padding-left: 20px; line-height: 1.6;">
            ${historyHtml}
          </ul>

          <p style="margin-top: 30px; text-align: center; color: #777; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
            Thank you for shopping with us!
          </p>
        </div>
      `;
    } else {
      console.warn(`[Email Worker] Unknown job type name: ${job.name}`);
      return;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"MEVN E-Commerce" <no-reply@mevn-marketplace.com>',
      to: order.contactEmail,
      subject,
      html
    };

    await sendEmail(mailOptions);
    console.log(`[Email Worker] Successfully processed and sent email for Job ID: ${job.id}`);
  },
  {
    connection: getRedisConnection(),
    concurrency: 1
  }
);

worker.on('completed', (job) => {
  console.log(`[Email Worker] Job '${job.name}' (id: ${job.id}) completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Email Worker] Job ${job ? job.id : 'unknown'} failed. Error:`, err);
});

console.log('[Email Worker] Standalone worker process running. Listening for email jobs...');
