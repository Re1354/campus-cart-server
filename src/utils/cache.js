/**
 * Ultra-fast in-memory cache with TTL and tag-based invalidation.
 * Zero dependencies, sub-millisecond lookups.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.tagMap = new Map(); // tag -> Set of keys
  }

  /**
   * Set a cached value
   * @param {string} key
   * @param {*} value
   * @param {number} ttlSeconds - Default 60 seconds
   * @param {string[]} tags - Optional tags for group invalidation
   */
  set(key, value, ttlSeconds = 60, tags = []) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt, tags });

    for (const tag of tags) {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag).add(key);
    }
  }

  /**
   * Get a cached value
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Delete a single key
   * @param {string} key
   */
  delete(key) {
    const item = this.store.get(key);
    if (item && item.tags) {
      for (const tag of item.tags) {
        const set = this.tagMap.get(tag);
        if (set) {
          set.delete(key);
          if (set.size === 0) this.tagMap.delete(tag);
        }
      }
    }
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a specific tag
   * e.g. invalidateTag('categories') or invalidateTag('products') or invalidateTag('orders')
   * @param {string} tag
   */
  invalidateTag(tag) {
    const keys = this.tagMap.get(tag);
    if (keys) {
      for (const key of keys) {
        this.store.delete(key);
      }
      this.tagMap.delete(tag);
    }
  }

  /**
   * Clear all cached items
   */
  clear() {
    this.store.clear();
    this.tagMap.clear();
  }
}

const cache = new MemoryCache();

module.exports = cache;
