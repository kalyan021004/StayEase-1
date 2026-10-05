// Business logic for PG listings.
const pgRepo = require("../repositories/pg.repository");
const roomRepo = require("../repositories/room.repository");
const AppError = require("../utils/AppError");
const { getOrSet, invalidateByPrefix } = require("../utils/cache");
const { CITIES } = require("../middlewares/validate.middleware");

const SEARCH_CACHE_PREFIX = "pg:search:";

async function createListing(ownerId, data) {
  if (!CITIES.includes(data.city)) {
    throw new AppError(`City must be one of: ${CITIES.join(", ")}`, 400);
  }
  const pg = await pgRepo.create({ ownerId, ...data });
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return pg;
}

async function assertOwns(id, ownerId) {
  const existing = await pgRepo.findById(id);
  if (!existing) throw new AppError("PG listing not found", 404);
  if (existing.owner_id !== ownerId) throw new AppError("You do not own this listing", 403);
  return existing;
}

async function updateListing(id, ownerId, fields) {
  await assertOwns(id, ownerId);
  const updated = await pgRepo.update(id, ownerId, fields);
  if (!updated) throw new AppError("Update failed", 400);
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return updated;
}

async function deleteListing(id, ownerId) {
  await assertOwns(id, ownerId);
  const active = await pgRepo.countActiveOccupants(id);
  if (active > 0) {
    throw new AppError(
      `This PG still has ${active} tenant(s) living in it. Vacate them before deleting the listing.`,
      409
    );
  }
  const deleted = await pgRepo.remove(id, ownerId);
  if (!deleted) throw new AppError("Delete failed", 400);
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return true;
}

async function approveListing(id) {
  const pg = await pgRepo.findById(id);
  if (!pg) throw new AppError("PG listing not found", 404);
  const updated = await pgRepo.updateStatus(id, "approved");
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return updated;
}

async function rejectListing(id) {
  const pg = await pgRepo.findById(id);
  if (!pg) throw new AppError("PG listing not found", 404);
  const updated = await pgRepo.updateStatus(id, "rejected");
  await invalidateByPrefix(SEARCH_CACHE_PREFIX);
  return updated;
}

async function getOwnerListings(ownerId) {
  return pgRepo.findByOwner(ownerId);
}

// Public detail page. Non-approved listings are only visible to their owner
// or an admin. Rooms are included (number, type, rent, beds free) so a tenant
// can pick one to book - but never who lives in them.
async function getListingById(id, viewer) {
  const pg = await pgRepo.findById(id);
  if (!pg) throw new AppError("PG listing not found", 404);

  const canSeeUnapproved =
    viewer && (viewer.role === "admin" || (viewer.role === "owner" && viewer.id === pg.owner_id));
  if (pg.status !== "approved" && !canSeeUnapproved) {
    throw new AppError("PG listing not found", 404);
  }

  const rooms = await roomRepo.publicRoomsForPg(id);
  return { ...pg, rooms };
}

async function searchListings(filters) {
  const page = filters.page || 1;
  const limit = filters.limit || 12;

  const normalized = {
    city: filters.city || "",
    genderType: filters.genderType || "",
    minRent: filters.minRent || "",
    maxRent: filters.maxRent || "",
    page,
    limit,
  };
  const cacheKey =
    SEARCH_CACHE_PREFIX +
    Object.entries(normalized)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

  // Fetch one extra row to know whether a next page exists, without a COUNT(*).
  const { data, fromCache } = await getOrSet(cacheKey, null, () =>
    pgRepo.search({ ...filters, page, limit: limit + 1, offsetLimit: limit })
  );

  return {
    pgs: data.slice(0, limit),
    hasMore: data.length > limit,
    page,
    limit,
    fromCache,
  };
}

async function listPendingListings() {
  return pgRepo.listPending();
}

module.exports = {
  createListing,
  getOwnerListings,
  getListingById,
  updateListing,
  deleteListing,
  searchListings,
  listPendingListings,
  approveListing,
  rejectListing,
  SEARCH_CACHE_PREFIX,
};
