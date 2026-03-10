import { Redis } from '@upstash/redis';

// 确保在无凭证的环境下不会导致构建崩溃
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://mock.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'mock-token',
});