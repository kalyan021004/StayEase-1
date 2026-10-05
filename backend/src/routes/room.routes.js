// Mounted at /api. Paths:
//   /api/pgs/:pgId/rooms                              (create, room-wise board)
//   /api/rooms/:roomId                                (update, delete)
//   /api/rooms/:roomId/assign                         (assign tenant by email)
//   /api/rooms/:roomId/occupants/:occupantId/remove   (vacate)
// Auth is applied per route (NOT router.use) because this router sits at the
// API root and must not block unrelated routes.
const express = require("express");
const router = express.Router();

const roomController = require("../controllers/room.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const {
  validate,
  validateParams,
  pgIdParam,
  roomIdParam,
  occupantParams,
  createRoomSchema,
  updateRoomSchema,
  assignTenantSchema,
} = require("../middlewares/validate.middleware");

const owner = [authenticate, requireRole("owner")];

router.post("/pgs/:pgId/rooms", ...owner, validateParams(pgIdParam), validate(createRoomSchema), roomController.createRoom);
router.get("/pgs/:pgId/rooms", ...owner, validateParams(pgIdParam), roomController.getRoomWiseDashboard);

router.patch("/rooms/:roomId", ...owner, validateParams(roomIdParam), validate(updateRoomSchema), roomController.updateRoom);
router.delete("/rooms/:roomId", ...owner, validateParams(roomIdParam), roomController.deleteRoom);
router.post("/rooms/:roomId/assign", ...owner, validateParams(roomIdParam), validate(assignTenantSchema), roomController.assignTenant);
router.post(
  "/rooms/:roomId/occupants/:occupantId/remove",
  ...owner,
  validateParams(occupantParams),
  roomController.removeTenant
);

module.exports = router;
