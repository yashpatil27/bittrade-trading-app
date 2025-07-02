const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

let client;

const createRedisClient = async () => {
  if (!client) {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          console.error('Redis connection attempts exhausted');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('Redis client connected');
    });

    client.on('ready', () => {
      console.log('Redis client ready');
    });

    try {
      await client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }
  return client;
};

const getRedisClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized. Call createRedisClient first.');
  }
  return client;
};

const setCache = async (key, value, expireInSeconds = 3600) => {
  try {
    const redisClient = getRedisClient();
    if (redisClient.isReady) {
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
    }
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

const getCache = async (key) => {
  try {
    const redisClient = getRedisClient();
    if (redisClient.isReady) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    const redisClient = getRedisClient();
    if (redisClient.isReady) {
      await redisClient.del(key);
    }
  } catch (error) {
    console.error('Redis delete error:', error);
  }
};

const clearUserCache = async (userId) => {
  try {
    const redisClient = getRedisClient();
    if (redisClient.isReady) {
      const keys = await redisClient.keys(`user:${userId}:*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (error) {
    console.error('Redis clear user cache error:', error);
  }
};

module.exports = {
  createRedisClient,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  clearUserCache
};
