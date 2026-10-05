// Loads Razorpay Checkout on demand (only when a tenant actually pays).
const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Opens Checkout for an order from POST /payments/bills/:billId/order.
 * Resolves "submitted" when Razorpay reports success in the browser - the bill
 * is only truly PAID once our webhook confirms it, so callers should poll.
 * Resolves "dismissed" if the user closes the window; rejects if they close it
 * after a failed attempt.
 */
export async function openCheckout({ order, keyId, user, description }) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    // A failed attempt leaves Checkout open so the user can retry with another
    // method; we only report the failure if they then close the window.
    let lastFailure = null;
    const rzp = new Razorpay({
      key: keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      name: "StayEase",
      description,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone || undefined },
      theme: { color: "#15233B" },
      handler: () => resolve("submitted"),
      modal: {
        ondismiss: () => (lastFailure ? reject(new Error(lastFailure)) : resolve("dismissed")),
      },
    });
    rzp.on("payment.failed", (resp) => {
      lastFailure = resp?.error?.description || "Payment failed. No money was taken.";
    });
    rzp.open();
  });
}
