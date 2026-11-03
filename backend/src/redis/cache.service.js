import redisClient from "./index.js";

// Process-local fallback in-memory TTL cache
// Used when Redis is disconnected or during development
const memoryCache = new Map();

/**
 * Check if Redis connection is active and ready
 */
const isRedisReady = () => redisClient && redisClient.isOpen;

/**
 * Clean expired keys from memory cache
 */
function cleanMemoryCache() {
    const now = Date.now();
    for (const [key, item] of memoryCache.entries()) {
        if (item.expiresAt && item.expiresAt <= now) {
            memoryCache.delete(key);
        }
    }
}

// Run periodic cleanup of memory cache every 60 seconds
if (typeof setInterval !== 'undefined') {
    setInterval(cleanMemoryCache, 60_000).unref?.();
}

/**
 * Retrieve cached value by key.
 * Checks Redis first; falls back to in-memory cache.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
    if (!key) return null;

    // 1. Try Redis
    if (isRedisReady()) {
        try {
            const raw = await redisClient.get(key);
            if (raw !== null && raw !== undefined) {
                try {
                    return JSON.parse(raw);
                } catch {
                    return raw;
                }
            }
            return null;
        } catch (err) {
            console.warn(`[CACHE] Redis GET error for key="${key}":`, err.message);
        }
    }

    // 2. Fallback to In-Memory cache
    const item = memoryCache.get(key);
    if (!item) return null;

    if (item.expiresAt && item.expiresAt <= Date.now()) {
        memoryCache.delete(key);
        return null;
    }

    return item.value;
}

/**
 * Store value in cache with a TTL (seconds).
 * Writes to Redis and updates local memory cache.
 *
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds - Default 30 seconds
 * @returns {Promise<boolean>}
 */
export async function cacheSet(key, value, ttlSeconds = 30) {
    if (!key) return false;

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const ttl = Math.max(1, Math.floor(ttlSeconds));

    // Update in-memory fallback
    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000
    });

    // Write to Redis
    if (isRedisReady()) {
        try {
            await redisClient.set(key, serialized, { EX: ttl });
            return true;
        } catch (err) {
            console.warn(`[CACHE] Redis SET error for key="${key}":`, err.message);
        }
    }

    return true;
}

/**
 * Delete a specific key from both Redis and in-memory cache.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function cacheDel(key) {
    if (!key) return false;

    memoryCache.delete(key);

    if (isRedisReady()) {
        try {
            await redisClient.del(key);
            return true;
        } catch (err) {
            console.warn(`[CACHE] Redis DEL error for key="${key}":`, err.message);
        }
    }

    return true;
}

/**
 * Invalidate all keys matching a wildcard pattern (e.g. "fabric:*", "admin:*")
 *
 * @param {string} pattern
 * @returns {Promise<number>} Number of keys invalidated
 */
export async function cacheDelPattern(pattern) {
    if (!pattern) return 0;

    let deletedCount = 0;

    // 1. Invalidate memory cache matching pattern
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memoryCache.keys()) {
        if (regexPattern.test(key)) {
            memoryCache.delete(key);
            deletedCount++;
        }
    }

    // 2. Invalidate in Redis
    if (isRedisReady()) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys && keys.length > 0) {
                await redisClient.del(keys);
                deletedCount = Math.max(deletedCount, keys.length);
            }
        } catch (err) {
            console.warn(`[CACHE] Redis DEL pattern error for "${pattern}":`, err.message);
        }
    }

    return deletedCount;
}

/**
 * Flush all cache entries
 */
export async function cacheFlush() {
    memoryCache.clear();
    if (isRedisReady()) {
        try {
            const keys = await redisClient.keys('zl:*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (err) {
            console.warn('[CACHE] Redis flush error:', err.message);
        }
    }
}
