import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  lazyConnect: false,
  maxRetriesPerRequest: 2,
  retryStrategy(times) {
    if (times > 5) {
      console.warn('Redis reconnection stopped after 5 attempts.');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

try {
  redis.on('connect', () => {
    console.log('Connected to Redis');
  });
  redis.on('error', (err) => {
    console.error('Redis error:', err.message || err);
  });
} catch (error) {
  console.log("error : ", error);
}

// brew services start redis
// brew services stop redis


// for server
// systemctl start redis-server
// systemctl stop redis-server