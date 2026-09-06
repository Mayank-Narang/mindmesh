const express = require('express');
const User = require('../models/User');
const { authenticate, generateToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Sliding-window limiter on login: 5 attempts per 5 mins
const baseLoginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many login attempts, please try again later.',
});

// Wrapper to namespace IP in the shared rateLimitStore and prevent collision with global limiter
const loginLimiter = (req, res, next) => {
  const originalIp = req.ip;
  const rawIp = req.ip || req.connection?.remoteAddress || 'unknown';
  try {
    Object.defineProperty(req, 'ip', {
      value: `${rawIp}:login`,
      configurable: true,
      writable: true,
    });
  } catch (_e) {
    // If defineProperty fails, proceed with default req.ip
  }

  baseLoginLimiter(req, res, (err) => {
    try {
      Object.defineProperty(req, 'ip', {
        value: originalIp,
        configurable: true,
        writable: true,
      });
    } catch (_e) {
      // ignore
    }
    next(err);
  });
};

// ---------------------------------------------------------------------------
// POST /api/auth/signup  —  Register a new user
// ---------------------------------------------------------------------------
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists with this email',
      });
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login  —  Authenticate user & issue token
// ---------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me  —  Get current user profile from token
// ---------------------------------------------------------------------------
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/auth/profile  —  Update current user profile (name, email)
// ---------------------------------------------------------------------------
router.put("/profile", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { name, email } = req.body;
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      user.name = name.trim();
    }
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: "Please provide a valid email address" });
      }
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }
      user.email = normalizedEmail;
    }

    await user.save();

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
