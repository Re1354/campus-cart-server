const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

/**
 * Sign a JWT with the given payload.
 * @param {{ userId: string, role: string }} payload
 * @returns {string} signed JWT
 */
const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * Verify and decode a JWT.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 * @param {string} token
 * @returns {{ userId: string, role: string, iat: number, exp: number }}
 */
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

/**
 * Standard cookie options for the auth token.
 * httpOnly prevents JS access; secure is enforced in production.
 */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

module.exports = { signToken, verifyToken, cookieOptions };
