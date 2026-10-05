// Business rules for bookings.
const bookingRepo = require("../repositories/booking.repository");
const roomRepo = require("../repositories/room.repository");
const AppError = require("../utils/AppError");
const { invalidateByPrefix } = require("../utils/cache");

async function requestBooking(tenantId, roomId, moveInDate) {
  const room = await roomRepo.findByIdWithPg(roomId);
  if (!room || room.pg_status !== "approved") throw new AppError("Room not found", 404);

  const alreadyPlaced = await roomRepo.findActiveOccupancyForTenant(tenantId);
  if (alreadyPlaced) {
    throw new AppError("You already live in a room booked through StayEase. Move out of it first.", 409);
  }

  const duplicate = await bookingRepo.findPendingForTenantRoom(tenantId, roomId);
  if (duplicate) {
    throw new AppError("You've already requested this room. The owner will respond soon.", 409);
  }

  if (room.status === "occupied") {
    // Fast, friendly pre-check only. The real guarantee is at confirm time,
    // inside the locked transaction.
    throw new AppError("This room is full right now. Try another room in this PG.", 409);
  }

  if (moveInDate && moveInDate < new Date().toISOString().slice(0, 10)) {
    throw new AppError("Move-in date can't be in the past", 400);
  }

  return bookingRepo.create({ tenantId, roomId, moveInDate });
}

async function getMyBookings(tenantId) {
  return bookingRepo.findByTenant(tenantId);
}

async function getPendingForOwner(ownerId) {
  return bookingRepo.findPendingForOwner(ownerId);
}

async function confirmBooking(ownerId, bookingId) {
  const booking = await bookingRepo.findByIdForOwner(bookingId, ownerId);
  if (!booking) throw new AppError("Booking not found or not yours to manage", 404);
  if (booking.status !== "pending") throw new AppError(`Booking is already ${booking.status}`, 409);

  let result;
  try {
    result = await bookingRepo.confirmBookingTransactional(bookingId, booking.tenant_id, booking.room_id);
  } catch (err) {
    if (err.isOperational) throw err;
    if (err.code === "23505") throw new AppError("This tenant already has an active room", 409);
    throw err;
  }

  switch (result.outcome) {
    case "confirmed":
      await invalidateByPrefix("pg:search:"); // vacancy changed
      return { booking: result.booking, occupant: result.occupant, roomStatus: result.roomStatus };
    case "room_full":
      throw new AppError(
        "Room is already full, so this request couldn't be confirmed. It has been marked declined.",
        409
      );
    case "tenant_placed":
      throw new AppError(
        "This tenant has already moved into another room, so the request was cancelled",
        409
      );
    case "not_pending":
    default:
      throw new AppError(`Booking is already ${result.status || "closed"}`, 409);
  }
}

async function rejectBooking(ownerId, bookingId) {
  const booking = await bookingRepo.findByIdForOwner(bookingId, ownerId);
  if (!booking) throw new AppError("Booking not found or not yours to manage", 404);
  if (booking.status !== "pending") throw new AppError(`Booking is already ${booking.status}`, 409);
  const rejected = await bookingRepo.rejectBooking(bookingId);
  if (!rejected) throw new AppError("Booking is no longer pending", 409);
  return rejected;
}

async function cancelBooking(tenantId, bookingId) {
  const cancelled = await bookingRepo.cancelBooking(bookingId, tenantId);
  if (!cancelled) throw new AppError("Booking not found, not yours, or no longer pending", 404);
  return cancelled;
}

module.exports = {
  requestBooking,
  getMyBookings,
  getPendingForOwner,
  confirmBooking,
  rejectBooking,
  cancelBooking,
};
