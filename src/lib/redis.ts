import Redis from 'ioredis';

// Create a Redis client singleton
let redis: Redis | undefined;

export const ExpireIn30Mins = 30 * 60; // 30 minutes

export function getRedisClient(): Redis {
  if (!redis) {
    // Use connection string from environment variable
    const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
    
    redis = new Redis(REDIS_URL, {
      // Recommended: Enable keep-alive to prevent connection issues
      keepAlive: 5000,
      // Optional: Set connection timeout
      connectTimeout: 10000,
      // Optional: Reconnect strategy
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Handle connection errors to prevent app crashes
    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
      // In production, consider reconnecting or alerting
    });
  }

  return redis;
}
