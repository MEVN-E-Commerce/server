import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import Order from '../modules/orders/order.model.js';

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
  console.log('[Email Service] SMTP credentials not provided. Falling back to console-logging mock transporter.');
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

export const sendVerificationEmail = async ({ email, name, token }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyLink = `${clientUrl}/verify-email/${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:5px;">
      <h2>Welcome${name ? ', ' + name : ''}!</h2>
      <p>Please verify your email address to activate your account:</p>
      <p><a href="${verifyLink}" style="display:inline-block;padding:10px 20px;background:#28a745;color:#fff;text-decoration:none;border-radius:4px;">Verify Email</a></p>
      <p>Or paste this link in your browser: ${verifyLink}</p>
      <p>This link expires in 24 hours.</p>
    </div>`;

  await sendEmail({
    from: process.env.SMTP_FROM || '"MEVN E-Commerce" <no-reply@mevn-marketplace.com>',
    to: email,
    subject: 'Verify Your Email Address',
    html
  });
  console.log(`[Email Service] Verification email sent directly to ${email}`);
};

export const sendOrderConfirmation = async (orderId) => {
  console.log(`[Email Service] Mock Order Confirmation sent directly for Order: ${orderId}`);
  const order = await Order.findById(orderId);
  if (!order) {
    console.error(`[Email Service] Order ${orderId} not found in database for confirmation email.`);
    return;
  }
  // Optional content logic if needed
};

export const sendOrderStatusUpdate = async (orderId) => {
  console.log(`[Email Service] Mock Order Status Update sent directly for Order: ${orderId}`);
  const order = await Order.findById(orderId);
  if (!order) {
    console.error(`[Email Service] Order ${orderId} not found in database for status update email.`);
    return;
  }
  // Optional content logic if needed
};
