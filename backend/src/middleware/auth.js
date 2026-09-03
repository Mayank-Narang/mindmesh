/**
 * @fileoverview Authentication and Authorization Middleware for MindMesh
 * 
 * Usage:
 * const { authenticate, authorize, generateToken } = require('./middleware/auth');
 * 
 * // Protect a route
 * app.get('/api/protected', authenticate, (req, res) => { ... });
 * 
 * // Protect a route with specific roles
 * app.delete('/api/admin/resource', authenticate, authorize('admin'), (req, res) => { ... });
 */

const jwt = require('jsonwebtoken');

/**
 * Express middleware to authenticate a user via JWT.
 * Extracts Bearer token from Authorization header and verifies it.
 * Attaches decoded payload to req.user.
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please provide a valid token.'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please provide a valid token.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please authenticate again.'
            });
        }
        return res.status(403).json({
            success: false,
            message: 'Invalid token. Access denied.'
        });
    }
};

/**
 * Higher-order middleware factory to authorize users based on roles.
 * Must be used AFTER `authenticate` middleware.
 * 
 * @param {...string} allowedRoles - List of allowed roles
 * @returns {import('express').RequestHandler} Express middleware function
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required before authorization.'
            });
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Insufficient permissions. Required role: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Utility to generate a signed JWT token.
 * 
 * @param {Object} payload - Data to encode in the token
 * @param {string|number} [expiresIn='7d'] - Token expiration
 * @returns {string} Signed JWT token
 */
const generateToken = (payload, expiresIn = '7d') => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

module.exports = {
    authenticate,
    authorize,
    generateToken
};
