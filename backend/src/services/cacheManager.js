import NodeCache from 'node-cache';
import { config } from '../config/index.js';

class CacheManager {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cacheTTL.summary,
      checkperiod: 600,
      useClones: false
    });
  }

  /**
   * Get cached data by key
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Set cache with key and value
   */
  set(key, value, ttl = null) {
    if (ttl) {
      this.cache.set(key, value, ttl);
    } else {
      this.cache.set(key, value);
    }
  }

  /**
   * Delete cache by key
   */
  del(key) {
    this.cache.del(key);
  }

  /**
   * Clear all cache
   */
  flushAll() {
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

export const cacheManager = new CacheManager();
