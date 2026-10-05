// Configuration: everything comes from process.env and is validated ONCE at
// startup. A missing/invalid variable stops the process immediately with a
// clear list of what is wrong, instead of a confusing crash later (e.g. the
// first time someone clicks "Pay" or "Export").
require("dotenv").config();
const { z } = require("zod");

const nonEmpty = (name) => z.string({ required_error: `${name} is required` }).min(1, `${name} is required`);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // Comma-separated list of allowed browser origins, e.g. "https://stayease.in,https://www.stayease.in"
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Number of reverse proxies in front of the API (load balancer = 1). Needed so
  // rate limiting sees the real client IP and not the proxy's IP.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  DATABASE_URL: nonEmpty("DATABASE_URL"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_SECRET: nonEmpty("JWT_SECRET").min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  REDIS_URL: nonEmpty("REDIS_URL"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(120),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  RAZORPAY_KEY_ID: nonEmpty("RAZORPAY_KEY_ID"),
  RAZORPAY_KEY_SECRET: nonEmpty("RAZORPAY_KEY_SECRET"),
  RAZORPAY_WEBHOOK_SECRET: nonEmpty("RAZORPAY_WEBHOOK_SECRET"),

  S3_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  // Endpoint used when SIGNING download URLs. Only differs from S3_ENDPOINT in
  // local docker (API reaches MinIO at http://minio:9000, browser at http://localhost:9000).
  S3_PUBLIC_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: nonEmpty("S3_BUCKET"),
  S3_ACCESS_KEY_ID: nonEmpty("S3_ACCESS_KEY_ID"),
  S3_SECRET_ACCESS_KEY: nonEmpty("S3_SECRET_ACCESS_KEY"),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Plain stderr on purpose: the logger itself depends on this config.
    process.stderr.write(
      `\n[config] Invalid or missing environment variables:\n${problems}\n` +
        `See backend/.env.example for the full list.\n\n`
    );
    process.exit(1);
  }
  const e = parsed.data;

  return {
    nodeEnv: e.NODE_ENV,
    isProd: e.NODE_ENV === "production",
    isTest: e.NODE_ENV === "test",
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    corsOrigins: e.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
    trustProxy: e.TRUST_PROXY,
    dbUrl: e.DATABASE_URL,
    dbPoolMax: e.DB_POOL_MAX,
    jwtSecret: e.JWT_SECRET,
    jwtExpiresIn: e.JWT_EXPIRES_IN,
    redisUrl: e.REDIS_URL,
    queueRedisUrl: e.REDIS_URL,
    cacheTtlSeconds: e.CACHE_TTL_SECONDS,
    authRateLimit: { max: e.AUTH_RATE_LIMIT_MAX, windowMs: e.AUTH_RATE_LIMIT_WINDOW_MS },
    razorpayKeyId: e.RAZORPAY_KEY_ID,
    razorpayKeySecret: e.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: e.RAZORPAY_WEBHOOK_SECRET,
    s3: {
      endpoint: e.S3_ENDPOINT,
      publicEndpoint: e.S3_PUBLIC_ENDPOINT || e.S3_ENDPOINT,
      region: e.S3_REGION,
      bucket: e.S3_BUCKET,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
    },
  };
}

module.exports = load();
