const express = require("express");
const router = express.Router();

const pgController = require("../controllers/pg.controller");
const { authenticate, optionalAuth, requireRole } = require("../middlewares/auth.middleware");
const {
  validate,
  validateQuery,
  validateParams,
  idParam,
  createPgSchema,
  updatePgSchema,
  searchQuerySchema,
} = require("../middlewares/validate.middleware");

const owner = [authenticate, requireRole("owner")];
const admin = [authenticate, requireRole("admin")];

// Static paths first so they are not captured by "/:id".
router.get("/search", validateQuery(searchQuerySchema), pgController.search);
router.get("/mine/list", ...owner, pgController.getMyListings);
router.get("/admin/pending", ...admin, pgController.pendingListings);
router.post("/admin/:id/approve", ...admin, validateParams(idParam), pgController.approveListing);
router.post("/admin/:id/reject", ...admin, validateParams(idParam), pgController.rejectListing);

// Public detail (approved listings only; owner/admin can also see their pending ones)
router.get("/:id", optionalAuth, validateParams(idParam), pgController.getListing);

// Owner CRUD
router.post("/", ...owner, validate(createPgSchema), pgController.createListing);
router.patch("/:id", ...owner, validateParams(idParam), validate(updatePgSchema), pgController.updateListing);
router.delete("/:id", ...owner, validateParams(idParam), pgController.deleteListing);

module.exports = router;
