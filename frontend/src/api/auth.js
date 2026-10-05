import { api } from "./client";

export const signup = (data) => api.post("/auth/signup", data, { auth: false });
export const login = (email, password) => api.post("/auth/login", { email, password }, { auth: false });
export const me = (opts) => api.get("/auth/me", opts);

// Admin
export const pendingOwners = (opts) => api.get("/auth/admin/pending-owners", opts);
export const approveOwner = (id) => api.post(`/auth/admin/owners/${id}/approve`);
export const rejectOwner = (id) => api.post(`/auth/admin/owners/${id}/reject`);
export const platformOverview = (opts) => api.get("/auth/admin/overview", opts);
