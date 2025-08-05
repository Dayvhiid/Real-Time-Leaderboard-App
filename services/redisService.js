import { createClient } from 'redis';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

 async connect() {
  try {
    // Only try to connect if REDIS_URL is set
    if (!process.env.REDIS_URL) {
      console.log('No REDIS_URL set. Skipping Redis connection. Using MongoDB fallback.');
      this.client = null;
      this.isConnected = false;
      return null;
    }

    const redisConfig = {
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: false // disables auto-reconnect spam
      }
    };

    this.client = createClient(redisConfig);

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    await this.client.connect();
    console.log('✅ Redis connection established successfully');
    return this.client;
  } catch (error) {
    console.error('❌ Redis connection error:', error.message);
    this.client = null;
    this.isConnected = false;
    return null;
  }
}

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client;
  }
}

// Create singleton instance
const redisService = new RedisService();

export default redisService;
