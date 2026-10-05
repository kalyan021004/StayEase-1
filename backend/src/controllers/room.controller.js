const roomService = require("../services/room.service");

// POST /api/pgs/:pgId/rooms  (owner only)
async function createRoom(req, res, next) {
  try {
    const room = await roomService.createRoom(req.user.id, req.params.pgId, req.body);
    res.status(201).json({ message: "Room created", room });
  } catch (err) {
    next(err);
  }
}

// GET /api/pgs/:pgId/rooms  (owner only) - the room-wise dashboard
async function getRoomWiseDashboard(req, res, next) {
  try {
    const rooms = await roomService.getRoomWiseDashboard(req.user.id, req.params.pgId);
    res.status(200).json({ rooms });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/rooms/:roomId  (owner only)
async function updateRoom(req, res, next) {
  try {
    const room = await roomService.updateRoom(req.user.id, req.params.roomId, req.body);
    res.status(200).json({ message: "Room updated", room });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rooms/:roomId  (owner only)
async function deleteRoom(req, res, next) {
  try {
    await roomService.deleteRoom(req.user.id, req.params.roomId);
    res.status(200).json({ message: "Room deleted" });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms/:roomId/assign  (owner only)
async function assignTenant(req, res, next) {
  try {
    const result = await roomService.assignTenant(
      req.user.id,
      req.params.roomId,
      req.body.tenantEmail,
      req.body.moveInDate
    );
    res.status(201).json({ message: "Tenant assigned to room", ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms/:roomId/occupants/:occupantId/remove  (owner only)
async function removeTenant(req, res, next) {
  try {
    const result = await roomService.removeTenant(
      req.user.id,
      req.params.roomId,
      req.params.occupantId
    );
    res.status(200).json({ message: "Tenant removed from room", ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRoom,
  getRoomWiseDashboard,
  updateRoom,
  deleteRoom,
  assignTenant,
  removeTenant,
};