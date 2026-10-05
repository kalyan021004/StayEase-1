import { api } from "./client";

// Returns { order, keyId, billId, amount } for Razorpay Checkout.
export const createOrder = (billId) => api.post(`/payments/bills/${billId}/order`);
