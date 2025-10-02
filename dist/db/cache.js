class SimpleCache {
    cache = new Map();
    defaultTTL = 5 * 60 * 1000; // 5 minutes
    set(key, value, ttlMs) {
        const expiry = Date.now() + (ttlMs || this.defaultTTL);
        this.cache.set(key, { value, expiry });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    // Clear all keys matching a pattern (e.g., "task:*")
    clearPattern(pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    // Cleanup expired entries periodically
    startCleanup(intervalMs = 60000) {
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (now > entry.expiry) {
                    this.cache.delete(key);
                }
            }
        }, intervalMs);
    }
}
export const cache = new SimpleCache();
cache.startCleanup();
