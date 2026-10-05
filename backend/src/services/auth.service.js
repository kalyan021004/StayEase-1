const userRepo = require("../repositories/user.repository");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

// Used when the email doesn't exist, so the response time is similar to a
// wrong password (prevents discovering registered emails by timing).
const DUMMY_HASH = "$2a$10$XQ60YDaqBaKzeCzl.GUxmeAPrCjbDBPZWM445BmD0FLDqeXVBOMIm";

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status };
}

async function signup({ name, email, password, phone, role }) {
  if (!["owner", "tenant"].includes(role)) {
    throw new AppError("Role must be 'owner' or 'tenant'", 400);
  }
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw new AppError("An account with this email already exists. Try logging in.", 409);
  }
  const passwordHash = await hashPassword(password);
  const status = role === "owner" ? "pending" : "approved";
  const user = await userRepo.createUser({ name, email, passwordHash, phone, role, status });
  return publicUser(user);
}

async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);
  // Same message for "no such email" and "wrong password" - don't reveal which
  // emails are registered.
  const match = await comparePassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !match) {
    throw new AppError("Incorrect email or password", 401);
  }
  if (user.role === "owner" && user.status === "pending") {
    throw new AppError(
      "Your owner account is waiting for admin approval. We'll let you in as soon as it's approved.",
      403
    );
  }
  if (user.status === "rejected" || user.status === "suspended") {
    throw new AppError(`Your account has been ${user.status}. Contact support if this is a mistake.`, 403);
  }

  const token = signToken({ id: user.id, role: user.role });
  return { token, user: publicUser(user) };
}

async function getCurrentUser(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("Account not found. Please log in again.", 401);
  if (user.status !== "approved") {
    throw new AppError(`Your account is ${user.status}. Please log in again.`, 401);
  }
  return publicUser(user);
}

async function listPendingOwners() {
  return userRepo.listPendingOwners();
}

async function platformOverview() {
  return userRepo.platformOverview();
}

async function approveOwner(ownerId) {
  const user = await userRepo.findById(ownerId);
  if (!user || user.role !== "owner") throw new AppError("Owner not found", 404);
  return userRepo.updateStatus(ownerId, "approved");
}

async function rejectOwner(ownerId) {
  const user = await userRepo.findById(ownerId);
  if (!user || user.role !== "owner") throw new AppError("Owner not found", 404);
  return userRepo.updateStatus(ownerId, "rejected");
}

module.exports = {
  signup,
  login,
  getCurrentUser,
  listPendingOwners,
  platformOverview,
  approveOwner,
  rejectOwner,
};
