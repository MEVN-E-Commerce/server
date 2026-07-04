import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Returns a new Redis connection configured for BullMQ.
 * BullMQ requires separate connection instances for Queue and Worker because of blocking Redis commands.
 */
export const getRedisConnection = () => {
  const conn = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });

  conn.on('error', (err) => {
    console.error('[Redis] Connection error:', err);
  });

  return conn;
};
