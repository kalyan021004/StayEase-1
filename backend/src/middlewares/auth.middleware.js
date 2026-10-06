const { verifyToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

// Video #8 - Authentication and authorization for backend engineers

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("No token provided", 401));
  }
  const token = header.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    next(new AppError("Invalid or expired token", 401));
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError("You do not have access to this resource", 403));
    }
    next();
  };
}

// ADD THIS - lets an external cron pinger trigger billing without a JWT,
// using a shared secret instead. Falls back to normal admin auth otherwise.
function allowCronOrAdmin(req, res, next) {
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return next();
  }
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requireRole("admin")(req, res, next);
  });
}


// AUTHENTICATION: is there a valid token?


// Same as authenticate, but anonymous requests are allowed through.
// Used by public endpoints that show extra data to owners/admins.
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, role: decoded.role };
  } catch {
    // ignore bad token on public routes
  }
  next();
}

// AUTHORIZATION: does this user have the right role?


module.exports = { authenticate, optionalAuth, requireRole,allowCronOrAdmin };
