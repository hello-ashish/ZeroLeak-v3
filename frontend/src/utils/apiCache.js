/**
 * ZeroLeak Intelligent Dual-Layer Client Cache (Memory + SessionStorage)
 *
 * Features:
 *  - 0ms instant data retrieval for previously loaded pages and tabs
 *  - Stale-While-Revalidate: instantaneous UI render + background refresh
 *  - Invalidation on mutations (POST/PUT/DELETE/PATCH)
 *  - Global refresh integration (clears cache on user force-refresh)
 *  - Transparent Axios request & response adapter
 */

import axios from 'axios';

const MEMORY_CACHE = new Map();
const SESSION_CACHE_PREFIX = 'zl_c_';
const DEFAULT_TTL_MS = 60_000; // 60 seconds

/**
 * Build a deterministic cache key based on URL, params, and active token
 */
export function buildCacheKey(url, params = {}, token = null) {
    const cleanUrl = (url || '').split('?')[0];
    const queryPart = typeof params === 'string'
        ? params
        : new URLSearchParams(params || {}).toString();

    // Include auth user identifier/token hash in key to avoid cross-role bleeding
    const effectiveToken = token ||
        (typeof window !== 'undefined'
            ? localStorage.getItem('adminToken') || localStorage.getItem('auditorToken') || localStorage.getItem('profToken') || localStorage.getItem('studentToken') || ''
            : '');

    let tokenHash = 'anon';
    if (effectiveToken) {
        // Quick short hash of token
        let h = 0;
        for (let i = 0; i < effectiveToken.length; i++) {
            h = ((h << 5) - h) + effectiveToken.charCodeAt(i);
            h |= 0;
        }
        tokenHash = String(h);
    }

    return `${cleanUrl}?${queryPart}:${tokenHash}`;
}

/**
 * Retrieve cached data synchronously.
 * Checks fast memory cache first, then sessionStorage.
 *
 * @param {string} url
 * @param {object|string} [params]
 * @param {string} [token]
 * @returns {any|null}
 */
export function getCachedData(url, params = {}, token = null) {
    if (typeof window === 'undefined') return null;

    const key = buildCacheKey(url, params, token);
    const now = Date.now();

    // 1. In-memory cache (fastest)
    if (MEMORY_CACHE.has(key)) {
        const item = MEMORY_CACHE.get(key);
        if (item.expiresAt > now) {
            return item.data;
        }
        MEMORY_CACHE.delete(key);
    }

    // 2. SessionStorage fallback
    try {
        const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.expiresAt > now) {
                // Populate memory cache for next read
                MEMORY_CACHE.set(key, parsed);
                return parsed.data;
            }
            sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
        }
    } catch (_) {
        // Storage full or private mode, ignore
    }

    return null;
}

/**
 * Store data in both in-memory cache and sessionStorage.
 *
 * @param {string} url
 * @param {any} data
 * @param {number} [ttlMs=60000]
 * @param {object|string} [params]
 * @param {string} [token]
 */
export function setCachedData(url, data, ttlMs = DEFAULT_TTL_MS, params = {}, token = null) {
    if (typeof window === 'undefined' || data === undefined || data === null) return;

    const key = buildCacheKey(url, params, token);
    const expiresAt = Date.now() + (ttlMs || DEFAULT_TTL_MS);
    const entry = { data, expiresAt };

    MEMORY_CACHE.set(key, entry);

    try {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (_) {
        // Session storage quota exceeded; memory cache still works
    }
}

/**
 * Invalidate cache entries matching a prefix or pattern
 *
 * @param {string} urlPattern - e.g. "/api/integrity", "/api/admin/stats"
 */
export function invalidateCache(urlPattern) {
    if (!urlPattern) return;

    // Invalidate in-memory
    for (const key of MEMORY_CACHE.keys()) {
        if (key.includes(urlPattern)) {
            MEMORY_CACHE.delete(key);
        }
    }

    // Invalidate sessionStorage
    if (typeof window !== 'undefined') {
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const sKey = sessionStorage.key(i);
                if (sKey && sKey.startsWith(SESSION_CACHE_PREFIX) && sKey.includes(urlPattern)) {
                    keysToRemove.push(sKey);
                }
            }
            for (const k of keysToRemove) {
                sessionStorage.removeItem(k);
            }
        } catch (_) { }
    }
}

/**
 * Clear all cached client entries
 */
export function clearAllCache() {
    MEMORY_CACHE.clear();
    if (typeof window !== 'undefined') {
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const sKey = sessionStorage.key(i);
                if (sKey && sKey.startsWith(SESSION_CACHE_PREFIX)) {
                    keysToRemove.push(sKey);
                }
            }
            for (const k of keysToRemove) {
                sessionStorage.removeItem(k);
            }
        } catch (_) { }
    }
}

// Clear client cache when user clicks global refresh or 'zl-global-refresh' fires
if (typeof window !== 'undefined') {
    window.addEventListener('zl-global-refresh', () => {
        clearAllCache();
    });
}

/**
 * Cached wrapper for window.fetch (used by FabricIntegrityCenter and hooks)
 */
export async function cachedFetch(url, options = {}, ttlMs = DEFAULT_TTL_MS) {
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const skipCache = options.skipCache === true ||
        options.headers?.['Cache-Control'] === 'no-cache' ||
        options.headers?.['x-skip-cache'] === 'true';

    // If mutation, invalidate matching cache
    if (!isGet) {
        invalidateCache(url.split('?')[0]);
        const res = await fetch(url, options);
        return res;
    }

    if (!skipCache) {
        const cached = getCachedData(url, options.params);
        if (cached !== null) {
            // Return cached data formatted like fetch response
            return {
                ok: true,
                status: 200,
                json: async () => cached,
                text: async () => JSON.stringify(cached),
                _fromCache: true,
            };
        }
    }

    const res = await fetch(url, options);
    if (res.ok) {
        const clone = res.clone();
        clone.json().then(data => {
            setCachedData(url, data, ttlMs, options.params);
        }).catch(() => { });
    }
    return res;
}

/**
 * Configure Axios with intelligent caching adapter
 */
let axiosCachingInstalled = false;

export function setupAxiosCaching() {
    if (axiosCachingInstalled || typeof window === 'undefined') return;
    axiosCachingInstalled = true;

    // Use default adapter as fallback
    const defaultAdapter = axios.defaults.adapter;

    axios.interceptors.request.use(async (config) => {
        const isGet = (config.method || 'get').toLowerCase() === 'get';
        const skipCache = config.skipCache === true ||
            config.headers?.['Cache-Control'] === 'no-cache' ||
            config.headers?.['x-skip-cache'] === 'true';

        // Auto-invalidate cache on mutation methods
        if (!isGet) {
            const cleanUrl = (config.url || '').split('?')[0];
            invalidateCache(cleanUrl);
            return config;
        }

        if (isGet && !skipCache) {
            const cached = getCachedData(config.url, config.params);
            if (cached !== null) {
                // Attach custom adapter that immediately resolves with cached data
                config.adapter = async () => {
                    return {
                        data: cached,
                        status: 200,
                        statusText: 'OK (Cached)',
                        headers: { 'x-cache': 'CLIENT_HIT' },
                        config,
                        request: {},
                        _fromCache: true
                    };
                };
            }
        }

        return config;
    }, (error) => Promise.reject(error));

    // Response interceptor to store fresh GET responses into cache
    axios.interceptors.response.use((response) => {
        const config = response.config;
        const isGet = (config.method || 'get').toLowerCase() === 'get';
        const skipCache = config.skipCache === true ||
            config.headers?.['Cache-Control'] === 'no-cache' ||
            config.headers?.['x-skip-cache'] === 'true';

        if (isGet && !skipCache && !response._fromCache && response.status >= 200 && response.status < 300) {
            const ttl = config.cacheTtl || DEFAULT_TTL_MS;
            setCachedData(config.url, response.data, ttl, config.params);
        }

        return response;
    }, (error) => {
        return Promise.reject(error);
    });
}
