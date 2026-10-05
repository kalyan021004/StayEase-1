// Payments via Razorpay. The webhook - not the browser - is the source of truth.
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const env = require("../config/env");
const logger = require("../utils/logger");
const billRepo = require("../repositories/bill.repository");
const paymentRepo = require("../repositories/payment.repository");
const AppError = require("../utils/AppError");

// Step 1: tenant clicks "Pay" -> create a Razorpay order for the bill.
async function createPaymentOrder(tenantId, billId) {
  const bill = await billRepo.findById(billId);
  if (!bill) throw new AppError("Bill not found", 404);
  if (bill.tenant_id !== tenantId) throw new AppError("This is not your bill", 403);
  if (bill.status === "paid") throw new AppError("This bill is already paid", 409);

  let order;
  try {
    order = await razorpay.orders.create({
      amount: Math.round(Number(bill.amount) * 100), // paise
      currency: "INR",
      receipt: `bill_${bill.id}`,
      notes: { billId: String(bill.id), tenantId: String(tenantId) },
    });
  } catch (err) {
    // The Razorpay SDK rejects with a plain object, not an Error.
    logger.error({ err: err && (err.error || err) }, "Razorpay order creation failed");
    throw new AppError("Payment gateway is not responding. Please try again in a minute.", 502);
  }

  return { order, keyId: env.razorpayKeyId, billId: bill.id, amount: Number(bill.amount) };
}

// Verify X-Razorpay-Signature = HMAC_SHA256(rawBody, webhookSecret) before
// trusting ANYTHING in the payload.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!Buffer.isBuffer(rawBody) || typeof signatureHeader !== "string" || !signatureHeader) {
    return false;
  }
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// Step 2: Razorpay tells us a payment was captured.
// Permanent problems (unknown bill, wrong amount) are logged at error level and
// acknowledged, because Razorpay would otherwise retry for hours and then
// disable the webhook. They need a human to look at them, not a retry.
async function handlePaymentCaptured(payload) {
  const payment = payload?.payload?.payment?.entity;
  if (!payment || !payment.id) {
    logger.error({ payload }, "Webhook payload missing payment entity");
    return { ignored: "malformed_payload" };
  }

  const billId = parseInt(payment.notes?.billId, 10);
  if (!billId) {
    logger.error({ paymentId: payment.id }, "Webhook payment has no billId in notes");
    return { ignored: "missing_bill_id" };
  }

  const bill = await billRepo.findById(billId);
  if (!bill) {
    logger.error({ billId, paymentId: payment.id }, "Webhook payment for unknown bill");
    return { ignored: "unknown_bill", billId };
  }

  if (Math.round(Number(bill.amount) * 100) !== payment.amount) {
    logger.error(
      { billId, billAmount: Number(bill.amount), paidPaise: payment.amount, paymentId: payment.id },
      "Payment amount does not match bill - NOT marking paid"
    );
    return { ignored: "amount_mismatch", billId };
  }
  if (bill.status === "paid") {
    logger.warn({ billId, paymentId: payment.id }, "Payment captured for an already-paid bill (possible double payment)");
  }

  // Transactional + idempotent (UNIQUE provider_ref): duplicate deliveries are no-ops.
  const result = await paymentRepo.recordCapturedPayment({
    billId,
    amount: payment.amount / 100,
    provider: "razorpay",
    providerRef: payment.id,
  });
  return { alreadyProcessed: result.alreadyProcessed, billId };
}

module.exports = { createPaymentOrder, verifyWebhookSignature, handlePaymentCaptured };
