const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { signToken, cookieOptions } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * GET /api/auth/google/callback (after passport verifies the OAuth code)
 * Passport attaches the found/created user to req.user.
 * We sign a JWT, set it as an httpOnly cookie, then redirect to the frontend.
 * The OAuth session is destroyed immediately after — JWT is the ongoing auth.
 */
exports.googleCallback = (req, res) => {
  const token = signToken({ userId: req.user.id, role: req.user.role });
  res.cookie('token', token, cookieOptions);

  // Destroy the short-lived OAuth session — JWT cookie takes over from here
  req.session.destroy(() => {
    res.redirect(process.env.CLIENT_URL);
  });
};

// ─── Vendor Registration ──────────────────────────────────────────────────────

/**
 * POST /api/auth/vendor/register
 * Body: { email, password, businessName }
 * Creates User (role: VENDOR) + VendorProfile (status: PENDING) in one transaction.
 * Does NOT issue a JWT — vendor must wait for admin approval before logging in.
 */
exports.vendorRegister = catchAsync(async (req, res, next) => {
  const { email, password, businessName } = req.body;

  if (!email || !password || !businessName) {
    return next(new AppError('email, password, and businessName are required', 400));
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return next(new AppError('An account with this email already exists', 409));
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: businessName,
        email,
        passwordHash,
        role: 'VENDOR',
      },
    });

    await tx.vendorProfile.create({
      data: {
        userId: user.id,
        businessName,
        status: 'PENDING',
      },
    });
  });

  res.status(201).json({
    message: 'Registration successful. Your account is awaiting admin approval.',
  });
});

// ─── Vendor Login ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/vendor/login
 * Body: { email, password }
 * Verifies password + approval status, then issues JWT as httpOnly cookie.
 */
exports.vendorLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { vendorProfile: true },
  });

  // Use a generic message to avoid leaking whether the email exists
  if (!user || !user.passwordHash) {
    return next(new AppError('Invalid email or password', 401));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (!user.vendorProfile || user.vendorProfile.status !== 'APPROVED') {
    return next(new AppError('Account pending approval', 403));
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Clears the JWT cookie. Works for both Google and vendor sessions.
 */
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

// ─── Get Current User ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 * Protected by the authenticate middleware (req.user must be set).
 */
exports.getMe = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mobileNumber: true,
      mobileVerified: true,
      vendorProfile: {
        select: {
          status: true,
          businessName: true,
          commissionRate: true,
        },
      },
    },
  });

  if (!user) {
    // Token valid but user deleted — clear stale cookie
    res.clearCookie('token');
    return res.status(401).json({ message: 'User account not found' });
  }

  res.json({ user });
});
