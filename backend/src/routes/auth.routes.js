const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { loginLimiter, signupLimiter } = require("../middlewares/rateLimit.middleware");
const {
  validate,
  validateParams,
  idParam,
  signupSchema,
  loginSchema,
} = require("../middlewares/validate.middleware");

const admin = [authenticate, requireRole("admin")];

// Public (rate limited against brute force / signup spam)
router.post("/signup", signupLimiter, validate(signupSchema), authController.signup);
router.post("/login", loginLimiter, validate(loginSchema), authController.login);

// Any logged-in user
router.get("/me", authenticate, authController.me);

// Admin
router.get("/admin/pending-owners", ...admin, authController.pendingOwners);
router.get("/admin/overview", ...admin, authController.platformOverview);
router.post("/admin/owners/:id/approve", ...admin, validateParams(idParam), authController.approveOwner);
router.post("/admin/owners/:id/reject", ...admin, validateParams(idParam), authController.rejectOwner);

module.exports = router;
