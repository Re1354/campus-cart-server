/**
 * Operational error class — errors we expect and want to send to the client.
 * Pass statusCode and a human-readable message.
 * Non-operational errors (programming bugs) will be caught separately.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
