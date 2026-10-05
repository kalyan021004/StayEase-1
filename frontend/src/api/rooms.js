import { api } from "./client";

// All owner-only
export const roomBoard = (pgId, opts) => api.get(`/pgs/${pgId}/rooms`, opts);
export const createRoom = (pgId, data) => api.post(`/pgs/${pgId}/rooms`, data);
export const updateRoom = (roomId, data) => api.patch(`/rooms/${roomId}`, data);
export const deleteRoom = (roomId) => api.del(`/rooms/${roomId}`);
export const assignTenant = (roomId, tenantEmail, moveInDate) =>
  api.post(`/rooms/${roomId}/assign`, { tenantEmail, ...(moveInDate ? { moveInDate } : {}) });
export const removeOccupant = (roomId, occupantId) => api.post(`/rooms/${roomId}/occupants/${occupantId}/remove`);
