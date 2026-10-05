// Thin controllers: parse request -> call service -> send response.
const bookingService = require("../services/booking.service");

// POST /api/bookings  (tenant)
async function requestBooking(req, res, next) {
  try {
    const booking = await bookingService.requestBooking(
      req.user.id,
      req.body.roomId,
      req.body.moveInDate
    );
    res.status(201).json({ message: "Booking requested, awaiting owner approval", booking });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/mine  (tenant)
async function getMyBookings(req, res, next) {
  try {
    const bookings = await bookingService.getMyBookings(req.user.id);
    res.status(200).json({ bookings });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings/:id/cancel  (tenant)
async function cancelBooking(req, res, next) {
  try {
    const booking = await bookingService.cancelBooking(req.user.id, req.params.id);
    res.status(200).json({ message: "Booking cancelled", booking });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/owner/pending  (owner)
async function getPendingForOwner(req, res, next) {
  try {
    const bookings = await bookingService.getPendingForOwner(req.user.id);
    res.status(200).json({ bookings });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings/:id/confirm  (owner) - the race-condition-sensitive one
async function confirmBooking(req, res, next) {
  try {
    const result = await bookingService.confirmBooking(req.user.id, req.params.id);
    res.status(200).json({ message: "Booking confirmed", ...result });
  } catch (err) {
    next(err); // a 409 "room is already full" lands here cleanly, not a crash
  }
}

// POST /api/bookings/:id/reject  (owner)
async function rejectBooking(req, res, next) {
  try {
    const booking = await bookingService.rejectBooking(req.user.id, req.params.id);
    res.status(200).json({ message: "Booking rejected", booking });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestBooking,
  getMyBookings,
  cancelBooking,
  getPendingForOwner,
  confirmBooking,
  rejectBooking,
};