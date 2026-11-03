import { cacheGet, cacheSet, cacheDelPattern } from "../redis/cache.service.js";

/**
 * Express middleware to cache GET endpoint responses.
 *
 * @param {Object} options
 * @param {number} [options.ttl=30] - Time to live in seconds
 * @param {string} [options.prefix='zl:api:'] - Redis/memory key prefix
 * @param {Function} [options.keyGenerator] - Optional custom key generator (req) => string
 * @param {Function} [options.condition] - Optional condition (req) => boolean
 */
export function cacheMiddleware({
    ttl = 30,
    prefix = 'zl:api:',
    keyGenerator = null,
    condition = null
} = {}) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Allow bypassing cache via header or query param
        if (
            req.headers['cache-control'] === 'no-cache' ||
            req.headers['x-skip-cache'] === 'true' ||
            req.query?.skipCache === 'true' ||
            req.query?.force === 'true'
        ) {
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }

        if (condition && !condition(req)) {
            return next();
        }

        // Generate cache key
        const userScope = req.user?._id || req.user?.id || req.admin?._id || 'public';
        const key = keyGenerator
            ? keyGenerator(req)
            : `${prefix}${req.baseUrl || ''}${req.path}?${new URLSearchParams(req.query || {}).toString()}:${userScope}`;

        try {
            const cachedData = await cacheGet(key);
            if (cachedData !== null && cachedData !== undefined) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
                return res.status(200).json(cachedData);
            }
        } catch (err) {
            console.warn('[CACHE_MIDDLEWARE] Read error:', err.message);
        }

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);

        // Capture original res.json to cache response body
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Only cache successful 200 responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cacheSet(key, body, ttl).catch(err => {
                    console.warn('[CACHE_MIDDLEWARE] Write error:', err.message);
                });
            }
            return originalJson(body);
        };

        next();
    };
}

/**
 * Express middleware to invalidate matching cache keys on mutation.
 *
 * @param {string|string[]} patterns - Patterns to invalidate (e.g. 'zl:api:/api/admin/stats*', 'fabric:*')
 */
export function invalidateCacheMiddleware(patterns) {
    const patternList = Array.isArray(patterns) ? patterns : [patterns];

    return (req, res, next) => {
        const originalEnd = res.end.bind(res);

        res.end = (...args) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                Promise.all(patternList.map(p => cacheDelPattern(p))).catch(err => {
                    console.warn('[CACHE_MIDDLEWARE] Invalidation error:', err.message);
                });
            }
            return originalEnd(...args);
        };

        next();
    };
}
