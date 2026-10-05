import { api } from "./client";

export const myBills = (opts) => api.get("/bills/mine", opts);
export const ownerBills = (filters, opts) => api.get("/bills/owner", { ...opts, params: filters });
// Returns { url, rowCount, filename, expiresInSeconds } - a signed URL valid for 5 minutes.
export const exportOwnerBills = (filters) => api.get("/bills/owner/export", { params: filters });
export const generateBills = (month) => api.post("/bills/admin/generate", month ? { month } : {});
