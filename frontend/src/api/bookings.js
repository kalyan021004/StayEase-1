import { api } from "./client";

// Tenant
export const requestBooking = (roomId, moveInDate) =>
  api.post("/bookings", { roomId, ...(moveInDate ? { moveInDate } : {}) });
export const myBookings = (opts) => api.get("/bookings/mine", opts);
export const cancelBooking = (id) => api.post(`/bookings/${id}/cancel`);

// Owner
export const pendingRequests = (opts) => api.get("/bookings/owner/pending", opts);
export const confirmBooking = (id) => api.post(`/bookings/${id}/confirm`);
export const rejectBooking = (id) => api.post(`/bookings/${id}/reject`);
