// Thin controllers: parse request -> call service -> send response.
const pgService = require("../services/pg.service");

// POST /api/pgs  (owner only)
async function createListing(req, res, next) {
  try {
    const pg = await pgService.createListing(req.user.id, req.body);
    res.status(201).json({ message: "Listing created, pending admin approval", pg });
  } catch (err) {
    next(err);
  }
}

// GET /api/pgs/mine/list  (owner only)
async function getMyListings(req, res, next) {
  try {
    const pgs = await pgService.getOwnerListings(req.user.id);
    res.status(200).json({ pgs });
  } catch (err) {
    next(err);
  }
}

// GET /api/pgs/:id  (public; includes rooms with vacancy, never occupant details)
async function getListing(req, res, next) {
  try {
    const pg = await pgService.getListingById(req.params.id, req.user);
    res.status(200).json({ pg });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/pgs/:id  (owner only, must own it)
async function updateListing(req, res, next) {
  try {
    const pg = await pgService.updateListing(req.params.id, req.user.id, req.body);
    res.status(200).json({ message: "Listing updated", pg });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/pgs/:id  (owner only, must own it)
async function deleteListing(req, res, next) {
  try {
    await pgService.deleteListing(req.params.id, req.user.id);
    res.status(200).json({ message: "Listing deleted" });
  } catch (err) {
    next(err);
  }
}

// GET /api/pgs/search  (public)
async function search(req, res, next) {
  try {
    const { pgs, page, limit, hasMore, fromCache } = await pgService.searchListings(req.query);
    res.status(200).json({ results: pgs.length, pgs, page, limit, hasMore, cached: fromCache });
  } catch (err) {
    next(err);
  }
}

// --- Admin ---

// GET /api/pgs/admin/pending  (admin only)
async function pendingListings(req, res, next) {
  try {
    const pgs = await pgService.listPendingListings();
    res.status(200).json({ pgs });
  } catch (err) {
    next(err);
  }
}

// POST /api/pgs/admin/:id/approve  (admin only)
async function approveListing(req, res, next) {
  try {
    const pg = await pgService.approveListing(req.params.id);
    res.status(200).json({ message: "Listing approved", pg });
  } catch (err) {
    next(err);
  }
}

// POST /api/pgs/admin/:id/reject  (admin only)
async function rejectListing(req, res, next) {
  try {
    const pg = await pgService.rejectListing(req.params.id);
    res.status(200).json({ message: "Listing rejected", pg });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createListing,
  getMyListings,
  getListing,
  updateListing,
  deleteListing,
  search,
  pendingListings,
  approveListing,
  rejectListing,
};