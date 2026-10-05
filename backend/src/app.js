const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");

const env = require("./config/env");
const logger = require("./utils/logger");
const routes = require("./routes");
const paymentController = require("./controllers/payment.controller");
const { pool } = require("./config/db");
const { redisClient } = require("./config/redis");
const { errorHandler, notFound } = require("./middlewares/error.middleware");

const app = express();

app.disable("x-powered-by");
if (env.trustProxy > 0) app.set("trust proxy", env.trustProxy);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    exposedHeaders: ["X-Request-Id", "RateLimit-Remaining", "Retry-After"],
  })
);

// Request ID + structured access log. Re-uses an incoming X-Request-Id (e.g.
// from a load balancer) so one request can be traced across services.
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && /^[\w-]{8,128}$/.test(incoming)
          ? incoming
          : crypto.randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customProps: (req) => (req.user ? { userId: req.user.id, role: req.user.role } : {}),
    autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// Webhook needs the RAW body for signature verification, so it is registered
// BEFORE express.json().
app.post(
  "/api/payments/webhook/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  paymentController.webhook
);

app.use(express.json({ limit: "100kb" }));

// Liveness: process is up. Readiness: dependencies reachable.
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ready", db: "ok", cache: redisClient.isReady ? "ok" : "degraded" });
  } catch {
    res.status(503).json({ status: "not_ready", db: "down" });
  }
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
