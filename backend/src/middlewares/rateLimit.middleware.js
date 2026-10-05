// Brute-force protection for login/signup.
//
// Uses the in-memory store: limits are per API instance. With N instances an
// attacker gets at most N x the limit, which is still a strong brake. If you
// scale out a lot, swap in a Redis store (rate-limit-redis) here.
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const env = require("../config/env");

function authLimiter(name) {
  return rateLimit({
    windowMs: env.authRateLimit.windowMs,
    limit: env.authRateLimit.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Key by IP + route so login and signup have separate budgets.
    keyGenerator: (req) => `${name}:${ipKeyGenerator(req.ip)}`,
    handler: (req, res, next, options) => {
      const retryMins = Math.ceil(options.windowMs / 60000);
      res.status(429).json({
        error: `Too many attempts. Please wait ${retryMins} minutes and try again.`,
      });
    },
  });
}

const loginLimiter = authLimiter("login");
const signupLimiter = authLimiter("signup");

module.exports = { loginLimiter, signupLimiter };
