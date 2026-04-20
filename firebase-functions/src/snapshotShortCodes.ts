/**
 * Scheduled Cloud Function: publish a lean shortcode snapshot to R2.
 *
 * Runs daily. Reads every `shortcodes/*` doc, emits only `{_id, encoded}`
 * pairs (docs without `encoded` are skipped — they're covered by the
 * Firestore primary path at resolve time). Uploads the resulting JSON to R2
 * so the SPA can fetch it as a static asset if Firestore is ever unreachable.
 *
 * Target: less than a few MB (at ~250 bytes/record, 50k records = 12 MB).
 *
 * Why R2 instead of git: no repo bloat, no commit PRs, served by CDN,
 * auto-refreshed without human involvement. If R2 itself is the failure
 * mode, the resolver also falls back to the git-committed snapshot under
 * static/data/snapshots/ that ships with the site.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./r2/r2-client";

const r2AccountId = defineSecret("R2_ACCOUNT_ID");
const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");
const r2BucketName = defineSecret("R2_BUCKET_NAME");

const SNAPSHOT_KEY = "snapshots/shortcodes-v2.json";
const SCHEMA_VERSION = 2;
const BATCH_SIZE = 500;

interface SkinnyRecord {
  _id: string;
  encoded: string;
}

async function buildSkinnySnapshot(): Promise<SkinnyRecord[]> {
  const db = admin.firestore();
  const records: SkinnyRecord[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let q = db.collection("shortcodes").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() as { encoded?: string };
      if (typeof data.encoded === "string" && data.encoded.length > 0) {
        records.push({ _id: doc.id, encoded: data.encoded });
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < BATCH_SIZE) break;
  }

  return records;
}

export const snapshotShortCodes = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName],
  })
  .region("us-central1")
  .pubsub.schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const start = Date.now();
    console.log("[snapshot] Building skinny snapshot…");

    const records = await buildSkinnySnapshot();
    const envelope = {
      _meta: {
        exportedAt: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        collection: "shortcodes",
        documentCount: records.length,
        source: "snapshotShortCodes cloud function",
      },
      documents: records,
    };

    const body = JSON.stringify(envelope);
    const sizeMb = (body.length / 1024 / 1024).toFixed(2);
    console.log(`[snapshot] Built ${records.length} records (${sizeMb} MB)`);

    const client = getR2Client(
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: SNAPSHOT_KEY,
        Body: body,
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
      })
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[snapshot] Uploaded r2://${bucket}/${SNAPSHOT_KEY} in ${elapsed}s`
    );
  });
