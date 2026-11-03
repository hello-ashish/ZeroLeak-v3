import redisClient from "../redis/index.js"

/**
 * Creates a rate limit middleware.
 * @param {string} keyPrefix    - Unique prefix for this endpoint (e.g., "ai:batch")
 * @param {number} maxRequests  - Max requests per window
 * @param {number} windowSeconds - Window size in seconds (default: 60)
 * @param {string} [userField]  - req property that holds the user doc (default: auto-detect)
 */
export function rateLimit(keyPrefix, maxRequests, windowSeconds = 60, userField = null) {
    return async (req, res, next) => {
        try {
            // Resolve the authenticated user from the request, regardless of role
            const user = userField
                ? req[userField]
                : (req.user || req.professor || req.admin || req.student || req.auditor);

            const userId = user?._id?.toString();
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" })
            }

            const key = `ratelimit:${keyPrefix}:${userId}`

            // Check if redis is connected
            if (!redisClient.isOpen) {
                // If redis is down, allow the request but log a warning
                console.warn("[RATE LIMIT] Redis not connected, skipping rate limit check")
                return next()
            }

            const current = await redisClient.incr(key)

            if (current === 1) {
                // First request in window — set expiry
                await redisClient.expire(key, windowSeconds)
            }

            if (current > maxRequests) {
                const ttl = await redisClient.ttl(key)
                return res.status(429).json({
                    message: "Rate limit exceeded. Please try again later.",
                    retryAfter: ttl > 0 ? ttl : windowSeconds,
                })
            }

            // Attach remaining count to response headers
            res.setHeader("X-RateLimit-Limit", maxRequests)
            res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - current))

            next()
        } catch (error) {
            // If rate limiting fails, don't block the request
            console.error("[RATE LIMIT] Error:", error.message)
            next()
        }
    }
}

export function loginRateLimit() {
    return async (req, res, next) => {
        try {
            const identifier = req.body.username || req.body.email || req.body.registrationNumber || "unknown";
            const ip = req.ip || req.connection?.remoteAddress || "unknown";

            const ipKey = `ratelimit:login:ip:${ip}`;
            const userKey = `ratelimit:login:user:${identifier}`;

            if (!redisClient.isOpen) {
                console.warn("[RATE LIMIT] Redis not connected, skipping login rate limit check");
                return next();
            }

            const maxIpAttempts = 20; // 20 attempts per IP per minute
            const maxUserAttempts = 10; // 10 attempts per account per minute

            const ipAttempts = await redisClient.incr(ipKey);
            if (ipAttempts === 1) await redisClient.expire(ipKey, 60);

            const userAttempts = await redisClient.incr(userKey);
            if (userAttempts === 1) await redisClient.expire(userKey, 60);

            let excess = 0;
            if (ipAttempts > maxIpAttempts) excess = Math.max(excess, ipAttempts - maxIpAttempts);
            if (userAttempts > maxUserAttempts) excess = Math.max(excess, userAttempts - maxUserAttempts);

            if (excess > 0) {
                // Progressive backoff: doubling every excess attempt, up to 15 minutes max
                // so we don't permanently lock out a legitimate user.
                const penaltyWindow = Math.min(60 * Math.pow(2, excess - 1), 900);

                if (ipAttempts > maxIpAttempts) await redisClient.expire(ipKey, penaltyWindow);
                if (userAttempts > maxUserAttempts) await redisClient.expire(userKey, penaltyWindow);

                console.warn(`[RATE LIMIT] Login blocked. IP: ${ip}, User: ${identifier}, Penalty: ${penaltyWindow}s`);

                return res.status(429).json({
                    message: "Too many login attempts. Please try again later.",
                    retryAfter: penaltyWindow,
                });
            }

            next();
        } catch (error) {
            console.error("[RATE LIMIT] Error in loginRateLimit:", error.message);
            next();
        }
    }
}
