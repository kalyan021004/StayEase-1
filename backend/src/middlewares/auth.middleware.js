const { verifyToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

// AUTHENTICATION: is there a valid token?
function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) return next(new AppError("Please log in to continue", 401));
  try {
    const decoded = verifyToken(token); // { id, role, iat, exp }
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    next(new AppError("Your session has expired. Please log in again.", 401));
  }
}

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
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError("You do not have access to this resource", 403));
    }
    next();
  };
}

module.exports = { authenticate, optionalAuth, requireRole };
