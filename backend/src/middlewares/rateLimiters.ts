import rateLimit from 'express-rate-limit';

// Slows brute-force password guessing on login without affecting the
// rest of the API. Keyed by IP (express-rate-limit's default).
// Only failed attempts count: many people signing in from one address
// (a school lab behind one NAT, or the same dev machine) never trip it.
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});
