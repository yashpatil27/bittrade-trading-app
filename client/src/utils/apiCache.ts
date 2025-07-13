interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

class ApiCache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 100; // Maximum cache entries

  set<T>(key: string, data: T, ttl: number = 30000): void { // Default 30 seconds
    // Check if cache is at max capacity
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (LRU-like behavior)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

export const apiCache = new ApiCache();

// Clean up cache every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 5 * 60 * 1000);
