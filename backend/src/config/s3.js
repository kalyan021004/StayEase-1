// Works with any S3-compatible provider: AWS S3, Cloudflare R2, MinIO (local).
const { S3Client } = require("@aws-sdk/client-s3");
const env = require("./env");

function makeClient(endpoint) {
  return new S3Client({
    endpoint,
    region: env.s3.region,
    forcePathStyle: env.s3.forcePathStyle,
    credentials: {
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey,
    },
  });
}

// Used for uploads (server -> bucket).
const s3 = makeClient(env.s3.endpoint);

// Used only to SIGN download URLs that the browser will open. In production
// both endpoints are the same; in local docker they differ (minio vs localhost).
const s3Public =
  env.s3.publicEndpoint === env.s3.endpoint ? s3 : makeClient(env.s3.publicEndpoint);

module.exports = { s3, s3Public };
