import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

// Setup connection for the queue
const connection = getRedisConnection();

export const emailQueue = new Queue('emails', {
  connection
});

/**
 * Enqueue order confirmation email job
 * @param {string} orderId 
 */
export const enqueueOrderConfirmation = async (orderId) => {
  await emailQueue.add(
    'order-confirmation', 
    { orderId }, 
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // Initial backoff delay of 5s
      }
    }
  );
  console.log(`[Queue] Enqueued 'order-confirmation' job for Order: ${orderId}`);
};

/**
 * Enqueue order status update email job
 * @param {string} orderId 
 */
export const enqueueOrderStatusUpdate = async (orderId) => {
  await emailQueue.add(
    'order-status-update', 
    { orderId }, 
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  );
  console.log(`[Queue] Enqueued 'order-status-update' job for Order: ${orderId}`);
};
