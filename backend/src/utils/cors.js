/**
 * ZeroLeak Centralized CORS Configuration
 *
 * Supports:
 *  - Explicit origins from ALLOWED_ORIGIN or CORS_ORIGIN env vars
 *  - Production Vercel domain (https://zero-leak-v2.vercel.app)
 *  - Preview Vercel deployments (*.vercel.app)
 *  - Local development environments (localhost, 127.0.0.1 on any port)
 *  - Render backend domain self-calls (*.onrender.com)
 *  - Non-browser clients (curl, Postman, same-origin, background workers)
 */

const getExplicitOrigins = () => {
    const raw = `${process.env.ALLOWED_ORIGIN || ""},${process.env.CORS_ORIGIN || ""}`;
    return raw
        .split(",")
        .map(o => o.trim())
        .filter(Boolean);
};

export const isOriginAllowed = (origin) => {
    // Non-browser or same-origin requests have no Origin header
    if (!origin) return true;

    // Check explicitly configured origins
    const explicit = getExplicitOrigins();
    if (explicit.includes(origin)) return true;

    try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();

        // Allow localhost and local loopback on any port
        if (host === "localhost" || host === "127.0.0.1") return true;

        // Allow Vercel production and all preview deployments
        if (host === "zero-leak-v2.vercel.app" || host.endsWith(".vercel.app")) return true;

        // Allow Render domains
        if (host === "zeroleak-v2.onrender.com" || host.endsWith(".onrender.com")) return true;
    } catch (_) {
        return false;
    }

    return false;
};

export const corsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        }
        // Do NOT pass `new Error(...)`: Express default error handler turns
        // unhandled middleware errors into 500 Internal Server Error.
        // Returning `callback(null, false)` cleanly disallows CORS without crashing.
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "x-skip-cache", "X-Requested-With", "Accept"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400
};
