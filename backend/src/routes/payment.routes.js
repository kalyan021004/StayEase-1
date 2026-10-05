const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validateParams, billIdParam } = require("../middlewares/validate.middleware");

router.post(
  "/bills/:billId/order",
  authenticate,
  requireRole("tenant"),
  validateParams(billIdParam),
  paymentController.createOrder
);

// The webhook route (POST /api/payments/webhook/razorpay) is mounted in app.js,
// BEFORE express.json(), because signature verification needs the raw body.

module.exports = router;
