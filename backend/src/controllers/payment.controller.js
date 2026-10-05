const paymentService = require("../services/payment.service");

// POST /api/payments/bills/:billId/order  (tenant)
async function createOrder(req, res, next) {
  try {
    const result = await paymentService.createPaymentOrder(req.user.id, req.params.billId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/webhook/razorpay  (public - called by Razorpay)
// req.body is the RAW Buffer here (see app.js).
async function webhook(req, res, next) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!paymentService.verifyWebhookSignature(req.body, signature)) {
      req.log.warn("Rejected webhook: invalid signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    if (payload.event === "payment.captured") {
      const result = await paymentService.handlePaymentCaptured(payload);
      req.log.info({ event: payload.event, ...result }, "Webhook processed");
    } else {
      req.log.info({ event: payload.event }, "Webhook event ignored");
    }

    // Respond 200 quickly once handled, or Razorpay will keep retrying.
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, webhook };
