// ============================================
// In-Memory Performance Cache with TTL
// ============================================

class SimpleCache {
  constructor(defaultTtlSeconds = 120) {
    this.cache = new Map()
    this.defaultTtl = defaultTtlSeconds * 1000
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item) return null
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    return item.value
  }

  set(key, value, ttlSeconds) {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    })
  }

  del(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  clearPrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }
}

export const publicCache = new SimpleCache(120)
