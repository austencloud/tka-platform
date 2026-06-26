#!/usr/bin/env node
/**
 * Apply (or list) the CORS policy on the Firebase Storage bucket.
 *
 * Firebase Storage buckets are Google Cloud Storage buckets. Browser fetches
 * against firebasestorage.googleapis.com (the public manifest in
 * cloud-thumbnail-cache.ts, thumbnail reads, client uploads) are blocked unless
 * the bucket carries a CORS policy listing the requesting origin. The gcloud /
 * gsutil CLIs are not installed here, so this talks to the GCS JSON API directly
 * using the same serviceAccountKey.json the seed scripts use.
 *
 *   node scripts/apply-storage-cors.cjs          # PATCH bucket cors from config/storage-cors.json
 *   node scripts/apply-storage-cors.cjs --list   # GET and print the bucket's current cors
 *
 * Mirrors the R2 pattern (npm run r2:cors:apply / r2:cors:list).
 */
const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVICE_ACCOUNT_PATH = path.join(PROJECT_ROOT, "serviceAccountKey.json");
const CORS_CONFIG_PATH = path.join(PROJECT_ROOT, "config", "storage-cors.json");
// Canonical client storage bucket (src/lib/shared/auth/firebase.ts storageBucket).
const BUCKET = "the-kinetic-alphabet.firebasestorage.app";

async function main() {
  const list = process.argv.includes("--list");

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Missing ${SERVICE_ACCOUNT_PATH}. Need the firebase-adminsdk service account key.`);
    process.exit(1);
  }

  const auth = new GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
  });
  const client = await auth.getClient();
  const base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}`;

  if (list) {
    const res = await client.request({ url: `${base}?fields=cors` });
    console.log(`CORS for ${BUCKET}:`);
    console.log(JSON.stringify(res.data.cors ?? [], null, 2));
    return;
  }

  const cors = JSON.parse(fs.readFileSync(CORS_CONFIG_PATH, "utf8"));
  const res = await client.request({
    url: `${base}?fields=cors`,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    data: { cors },
  });
  console.log(`Applied CORS to ${BUCKET}. Bucket now reports:`);
  console.log(JSON.stringify(res.data.cors ?? [], null, 2));
}

main().catch((err) => {
  const detail = err?.response?.data ?? err?.message ?? err;
  console.error("Failed to apply storage CORS:", JSON.stringify(detail, null, 2));
  process.exit(1);
});
