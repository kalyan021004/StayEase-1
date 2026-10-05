const authService = require("../services/auth.service");

// POST /api/auth/signup
async function signup(req, res, next) {
  try {
    const user = await authService.signup(req.body);
    const message =
      user.role === "owner"
        ? "Signup successful. Your account is pending admin approval."
        : "Signup successful. You can now log in.";
    res.status(201).json({ message, user });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me - fresh profile from the DB (not just the token claims), so
// a suspended/rejected account is logged out on the next page load.
async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/admin/pending-owners
async function pendingOwners(req, res, next) {
  try {
    const owners = await authService.listPendingOwners();
    res.status(200).json({ owners });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/admin/overview
async function platformOverview(req, res, next) {
  try {
    const overview = await authService.platformOverview();
    res.status(200).json({ overview });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/admin/owners/:id/approve
async function approveOwner(req, res, next) {
  try {
    const owner = await authService.approveOwner(req.params.id);
    res.status(200).json({ message: "Owner approved", owner });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/admin/owners/:id/reject
async function rejectOwner(req, res, next) {
  try {
    const owner = await authService.rejectOwner(req.params.id);
    res.status(200).json({ message: "Owner rejected", owner });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, me, pendingOwners, platformOverview, approveOwner, rejectOwner };
