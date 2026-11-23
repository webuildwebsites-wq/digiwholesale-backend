import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();


export const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

try {
  redis.on('connect', () => {
    console.log('Connected to Redis');
  });
  redis.on('error', (err) => {
    console.error('Redis error:', err);
  });
} catch (error) {
  console.log("error : ",error);
}

// brew services start redis
// brew services stop redis


// for server
// systemctl start redis-server
// systemctl stop redis-server