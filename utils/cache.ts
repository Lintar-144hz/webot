/**
 * Simple in-memory cache system with TTL (Time To Live)
 */
export class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private defaultTtlMs: number;

  /**
   * @param defaultTtlSeconds Default TTL in seconds
   */
  constructor(defaultTtlSeconds: number = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlSeconds Optional custom TTL in seconds
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get a value from the cache if it hasn't expired
   * @param key Cache key
   */
  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Delete a key from cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }
}

// Export a singleton instance specifically for tiktok profile caching (5 minutes TTL)
export const tiktokCache = new MemoryCache<any>(300);
