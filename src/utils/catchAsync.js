/**
 * Wraps an async route handler so that any rejected Promise is forwarded
 * to Express's next(err) — eliminates try/catch boilerplate in controllers.
 *
 * Usage:
 *   router.get('/route', catchAsync(async (req, res, next) => { ... }));
 */
const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = catchAsync;
