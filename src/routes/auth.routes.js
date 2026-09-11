const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

// ─── Google OAuth ─────────────────────────────────────────────────────────────

// Step 1: Redirect browser to Google consent screen
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2: Google redirects here after user consents
// passport.authenticate verifies the state + exchanges code for profile
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth` }),
  authController.googleCallback
);

// ─── Vendor Auth ──────────────────────────────────────────────────────────────

// POST /api/auth/vendor/register
router.post('/vendor/register', authController.vendorRegister);

// POST /api/auth/vendor/login
router.post('/vendor/login', authController.vendorLogin);

// ─── Common ───────────────────────────────────────────────────────────────────

// POST /api/auth/logout
router.post('/logout', authController.logout);

// GET /api/auth/me  — requires valid JWT cookie
router.get('/me', authenticate, authController.getMe);

// ─── Test Routes (remove in production) ──────────────────────────────────────

// GET /api/auth/test-admin-only — verify authenticate + requireRole(['ADMIN']) works
router.get(
  '/test-admin-only',
  authenticate,
  requireRole(['ADMIN']),
  (req, res) => res.json({ message: 'You are an admin' })
);

module.exports = router;
