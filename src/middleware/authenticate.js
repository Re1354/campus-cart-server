const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Verifies the JWT from the httpOnly cookie.
 * Attaches the decoded payload as `req.user` ({ userId, role }).
 * Returns 401 if the token is missing, expired, or invalid.
 */
const authenticate = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError('Not authenticated — please log in', 401));
  }

  try {
    const decoded = verifyToken(token);
    req.user = { ...decoded, id: decoded.userId }; // { userId, id, role, iat, exp }
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token — please log in again', 401));
  }
};

module.exports = authenticate;
