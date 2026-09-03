/**
 * @fileoverview In-memory sliding-window rate limiter middleware for Express.
 * 
 * Usage:
 * const { createRateLimiter } = require('./middleware/rateLimiter');
 * 
 * // Global rate limit
 * app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));
 * 
 * // Per-route limit
 * const loginLimiter = createRateLimiter({
 *   windowMs: 5 * 60 * 1000, // 5 minutes
 *   maxRequests: 5,
 *   message: 'Too many login attempts, please try again later.'
 * });
 * app.post('/api/auth/login', loginLimiter, authController.login);
 */

// Store IPs and their request counts
const rateLimitStore = new Map();
let cleanupInterval = null;

/**
 * Factory function to create a rate limiting middleware.
 * 
 * @param {Object} options - Rate limiter options
 * @param {number} [options.windowMs=900000] - Time window in milliseconds (default 15 minutes)
 * @param {number} [options.maxRequests=100] - Max requests allowed per window per IP
 * @param {string} [options.message='Too many requests, please try again later.'] - Custom error message
 * @returns {import('express').RequestHandler} Express middleware
 */
const createRateLimiter = (options = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const maxRequests = options.maxRequests || 100;
    const message = options.message || 'Too many requests, please try again later.';

    // Start cleanup interval if not already running
    if (!cleanupInterval) {
        cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [ip, data] of rateLimitStore.entries()) {
                if (now > data.resetTime) {
                    rateLimitStore.delete(ip);
                }
            }
        }, windowMs);
        
        // Allow the process to exit even if this interval is running
        if (cleanupInterval.unref) {
            cleanupInterval.unref();
        }
    }

    return (req, res, next) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        
        let record = rateLimitStore.get(ip);
        
        if (!record || now > record.resetTime) {
            // New window
            record = {
                count: 1,
                resetTime: now + windowMs
            };
            rateLimitStore.set(ip, record);
        } else {
            // Existing window
            record.count += 1;
        }

        const remaining = Math.max(0, maxRequests - record.count);
        const resetTimeSec = Math.ceil(record.resetTime / 1000);
        
        // Set headers for all responses
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTimeSec);

        if (record.count > maxRequests) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            return res.status(429).json({
                success: false,
                message,
                retryAfter
            });
        }

        next();
    };
};

/**
 * Clears the rate limit store and stops the cleanup interval.
 * Mainly used for testing.
 */
const clearRateLimitStore = () => {
    rateLimitStore.clear();
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
};

module.exports = {
    createRateLimiter,
    clearRateLimitStore
};
