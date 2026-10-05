const express = require("express");
const router = express.Router();

const bookingController = require("../controllers/booking.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const {
  validate,
  validateParams,
  idParam,
  requestBookingSchema,
} = require("../middlewares/validate.middleware");

const tenant = [authenticate, requireRole("tenant")];
const owner = [authenticate, requireRole("owner")];

// Tenant
router.post("/", ...tenant, validate(requestBookingSchema), bookingController.requestBooking);
router.get("/mine", ...tenant, bookingController.getMyBookings);
router.post("/:id/cancel", ...tenant, validateParams(idParam), bookingController.cancelBooking);

// Owner
router.get("/owner/pending", ...owner, bookingController.getPendingForOwner);
router.post("/:id/confirm", ...owner, validateParams(idParam), bookingController.confirmBooking);
router.post("/:id/reject", ...owner, validateParams(idParam), bookingController.rejectBooking);

module.exports = router;
