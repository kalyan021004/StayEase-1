// Test configuration. Tests run against a REAL Postgres (the booking race
// tests depend on real row locks) - point TEST_DATABASE_URL at a throwaway DB.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://stayease:stayease@localhost:5432/stayease_test";
process.env.DB_POOL_MAX = "20";
process.env.JWT_SECRET = "test-secret-that-is-definitely-longer-than-32-chars";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.AUTH_RATE_LIMIT_MAX = "20";
process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "dummy_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
process.env.S3_ENDPOINT = "http://localhost:9000";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test";
process.env.S3_SECRET_ACCESS_KEY = "test";
process.env.S3_FORCE_PATH_STYLE = "true";
