const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

/**
 * Verifies the JWT from the httpOnly cookie and checks user active status.
 * Attaches the authenticated user to `req.user` ({ userId, id, role }).
 * Returns 401 if token is missing/invalid or user not found.
 * Returns 403 if user is deactivated.
 */
const authenticate = async (req, res, next) => {
  let token = req.cookies?.token;

  // Fallback to Bearer token from Authorization header if cookie not present
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authenticated — please log in', 401));
  }

  try {
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user) {
      res.clearCookie('token');
      return next(new AppError('User account not found', 401));
    }

    if (!user.isActive) {
      res.clearCookie('token');
      return next(new AppError('Your account has been deactivated. Please contact support.', 403));
    }

    req.user = { userId: user.id, id: user.id, role: user.role };
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token — please log in again', 401));
  }
};

module.exports = authenticate;
