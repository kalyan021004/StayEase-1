// Business logic for rooms. Every change that affects vacancy also clears the
// search cache, otherwise tenants would see stale "beds free" numbers.
const roomRepo = require("../repositories/room.repository");
const pgRepo = require("../repositories/pg.repository");
const userRepo = require("../repositories/user.repository");
const AppError = require("../utils/AppError");
const { invalidateByPrefix } = require("../utils/cache");

const SEARCH_CACHE_PREFIX = "pg:search:";

async function assertOwnsPg(ownerId, pgId) {
  const pg = await pgRepo.findById(pgId);
  if (!pg) throw new AppError("PG not found", 404);
  if (pg.owner_id !== ownerId) throw new AppError("You do not own this PG", 403);
  return pg;
}

async function assertOwnsRoom(ownerId, roomId) {
  const room = await roomRepo.findByIdForOwner(roomId, ownerId);
  if (!room) throw new AppError("Room not found or not yours", 404);
  return room;
}

async function createRoom(ownerId, pgId, data) {
  await assertOwnsPg(ownerId, pgId);
  const room = await roomRepo.create({ pgId, ...data });
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return room;
}

async function getRoomWiseDashboard(ownerId, pgId) {
  await assertOwnsPg(ownerId, pgId);
  return roomRepo.roomWiseView(pgId);
}

async function updateRoom(ownerId, roomId, fields) {
  await assertOwnsRoom(ownerId, roomId);
  const updated = await roomRepo.updateTransactional(roomId, fields);
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return updated;
}

async function deleteRoom(ownerId, roomId) {
  await assertOwnsRoom(ownerId, roomId);
  const activeCount = await roomRepo.countActiveOccupants(roomId);
  if (activeCount > 0) {
    throw new AppError("Cannot delete a room with tenants in it. Vacate them first.", 409);
  }
  const removed = await roomRepo.remove(roomId);
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return removed;
}

async function assignTenant(ownerId, roomId, tenantEmail, moveInDate) {
  await assertOwnsRoom(ownerId, roomId);

  const tenant = await userRepo.findByEmail(tenantEmail);
  if (!tenant || tenant.role !== "tenant") {
    throw new AppError(
      "No tenant account found with that email. Ask them to sign up on StayEase first.",
      404
    );
  }

  const alreadyPlaced = await roomRepo.findActiveOccupancyForTenant(tenant.id);
  if (alreadyPlaced) throw new AppError("This tenant is already assigned to a room", 409);

  const result = await roomRepo.assignTenantTransactional(roomId, tenant.id, moveInDate);
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return result;
}

async function removeTenant(ownerId, roomId, occupantId) {
  await assertOwnsRoom(ownerId, roomId);
  const result = await roomRepo.vacateOccupantTransactional(roomId, occupantId);
  if (!result) throw new AppError("Occupant not found in this room, or already vacated", 404);
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return result;
}

module.exports = {
  createRoom,
  getRoomWiseDashboard,
  updateRoom,
  deleteRoom,
  assignTenant,
  removeTenant,
};
