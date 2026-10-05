const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const pgRoutes = require("./pg.routes");
const roomRoutes = require("./room.routes");
const bookingRoutes = require("./booking.routes");
const billingRoutes = require("./billing.routes");
const paymentRoutes = require("./payment.routes");

router.use("/auth", authRoutes);
// Room routes define full paths (/pgs/:pgId/rooms and /rooms/:roomId...), so
// they are mounted at the API root. They must come BEFORE the PG router so
// "/pgs/:pgId/rooms" is not shadowed.
router.use("/", roomRoutes);
router.use("/pgs", pgRoutes);
router.use("/bookings", bookingRoutes);
router.use("/bills", billingRoutes);
router.use("/billing", billingRoutes); // backward-compatible alias for older clients
router.use("/payments", paymentRoutes);

module.exports = router;
