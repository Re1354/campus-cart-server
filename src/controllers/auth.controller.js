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
  if (!req.user || !req.user.isActive) {
    return req.session.destroy(() => {
      res.redirect(`${process.env.CLIENT_URL}/login?error=account_deactivated`);
    });
  }

  const token = signToken({ userId: req.user.id, role: req.user.role });
  res.cookie('token', token, cookieOptions);

  // Destroy the short-lived OAuth session — JWT cookie takes over from here
  req.session.destroy(() => {
    res.redirect(process.env.CLIENT_URL);
  });
};

// ─── Firebase Authentication Bridge ───────────────────────────────────────────

/**
 * POST /api/auth/firebase-login
 * Body: { email, name, uid }
 * Synchronizes Firebase-authenticated user (Google SSO or Email/Password) with PostgreSQL database
 * and issues standard HTTP-only JWT session cookie.
 */
exports.firebaseLogin = catchAsync(async (req, res, next) => {
  const { email, name, uid } = req.body;

  if (!email) {
    return next(new AppError('Email is required', 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { vendorProfile: true },
  });

  if (!user) {
    // Automatically register as verified student buyer
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        googleId: uid,
        role: 'USER',
        isActive: true,
      },
      include: { vendorProfile: true },
    });
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  // If user is a vendor, verify approved status
  if (user.role === 'VENDOR') {
    if (!user.vendorProfile || user.vendorProfile.status !== 'APPROVED') {
      if (user.vendorProfile?.status === 'REJECTED') {
        return next(
          new AppError(
            `Account rejected: ${user.vendorProfile.rejectionReason || 'Application was not approved'}`,
            403
          )
        );
      }
      if (user.vendorProfile?.status === 'SUSPENDED') {
        return next(new AppError('Your vendor account has been suspended.', 403));
      }
      return next(new AppError('Account pending admin approval', 403));
    }
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

// ─── Vendor Registration ──────────────────────────────────────────────────────

/**
 * POST /api/auth/vendor/register
 * Body: { email, password, businessName }
 * Creates User (role: VENDOR) + VendorProfile (status: PENDING) in one transaction.
 * Does NOT issue a JWT — vendor must wait for admin approval before logging in.
 */
exports.vendorRegister = catchAsync(async (req, res, next) => {
  const { email, password, businessName, whatsappNumber, mobileNumber } = req.body;

  if (!email || !password || !businessName) {
    return next(new AppError('email, password, and businessName are required', 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const phone = (whatsappNumber || mobileNumber || '').trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return next(new AppError('An account with this email already exists', 409));
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: businessName,
        email: normalizedEmail,
        passwordHash,
        role: 'VENDOR',
        mobileNumber: phone || null,
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

// ─── Admin Credential Login ───────────────────────────────────────────────────

/**
 * POST /api/auth/admin/login
 * Body: { email, password }
 * Authenticates ADMIN accounts exclusively. Rejects non-admin attempts.
 */
exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Enforce ADMIN role
  if (user.role !== 'ADMIN') {
    return next(new AppError('Access denied. Only authorized administrators can log in here.', 403));
  }

  if (!user.isActive) {
    return next(new AppError('Your administrator account has been deactivated.', 403));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new AppError('Invalid email or password', 401));
  }

  const token = signToken({ userId: user.id, role: 'ADMIN' });
  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Admin login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'ADMIN',
      isActive: user.isActive,
    },
  });
});

// ─── Vendor Credential Login ──────────────────────────────────────────────────

/**
 * POST /api/auth/vendor/login
 * Body: { email, password }
 * Authenticates VENDOR accounts. Rejects non-vendors and verifies admin approval.
 */
exports.vendorLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { vendorProfile: true },
  });

  if (!user || !user.passwordHash) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Enforce VENDOR role
  if (user.role !== 'VENDOR') {
    return next(new AppError('Access denied. Only registered vendor accounts can log in here.', 403));
  }

  if (!user.isActive) {
    return next(new AppError('Your vendor account has been deactivated. Please contact support.', 403));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Verify vendor approval status
  if (!user.vendorProfile || user.vendorProfile.status !== 'APPROVED') {
    if (user.vendorProfile?.status === 'REJECTED') {
      return next(
        new AppError(
          `Application rejected: ${user.vendorProfile.rejectionReason || 'Application was not approved'}`,
          403
        )
      );
    }
    if (user.vendorProfile?.status === 'SUSPENDED') {
      return next(new AppError('Your vendor account has been suspended. Please contact support.', 403));
    }
    return next(
      new AppError(
        'Your vendor application is currently awaiting administrator approval. You will receive access once approved.',
        403
      )
    );
  }

  const token = signToken({ userId: user.id, role: 'VENDOR' });
  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Vendor login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'VENDOR',
      isActive: user.isActive,
      vendorProfile: {
        businessName: user.vendorProfile.businessName,
        status: user.vendorProfile.status,
      },
    },
  });
});

// ─── Unified Credential Login (Fallback) ──────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Backwards-compatible generic login.
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required', 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { vendorProfile: true },
  });

  if (!user || !user.passwordHash) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (user.role === 'VENDOR') {
    if (!user.vendorProfile || user.vendorProfile.status !== 'APPROVED') {
      if (user.vendorProfile?.status === 'REJECTED') {
        return next(
          new AppError(
            `Account rejected: ${user.vendorProfile.rejectionReason || 'Application was not approved'}`,
            403
          )
        );
      }
      if (user.vendorProfile?.status === 'SUSPENDED') {
        return next(new AppError('Your vendor account has been suspended.', 403));
      }
      return next(new AppError('Your vendor application is awaiting administrator approval.', 403));
    }
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Clears the JWT cookie. Works for both Google and credential sessions.
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
      isActive: true,
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

  if (!user || !user.isActive) {
    res.clearCookie('token');
    return res.status(401).json({ message: 'User account not found or deactivated' });
  }

  res.json({ user });
});
