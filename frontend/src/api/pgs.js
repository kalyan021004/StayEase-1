import { api } from "./client";

// Public
export const searchPgs = (filters, opts) => api.get("/pgs/search", { ...opts, params: filters, auth: false });
export const getPg = (id, opts) => api.get(`/pgs/${id}`, opts); // sends token if logged in (owner preview)

// Owner
export const myListings = (opts) => api.get("/pgs/mine/list", opts);
export const createListing = (data) => api.post("/pgs", data);
export const updateListing = (id, data) => api.patch(`/pgs/${id}`, data);
export const deleteListing = (id) => api.del(`/pgs/${id}`);

// Admin
export const pendingListings = (opts) => api.get("/pgs/admin/pending", opts);
export const approveListing = (id) => api.post(`/pgs/admin/${id}/approve`);
export const rejectListing = (id) => api.post(`/pgs/admin/${id}/reject`);
