/**
 * Scheduled Cloud Function: publish a lean shortcode snapshot to R2.
 *
 * Runs daily. Reads every `shortcodes/*` doc. Word records emit only
 * `{_id, encoded}`; schema-3 solo records add the small identity envelope
 * needed to retain their title and authored hand offline. Docs without
 * `encoded` are skipped because the Firestore primary path serves their
 * canonical embedded payload.
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
import { gzip } from "zlib";
import { promisify } from "util";
import { getR2Client } from "./r2/r2-client";

const gzipAsync = promisify(gzip);

const r2AccountId = defineSecret("R2_ACCOUNT_ID");
const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");
const r2BucketName = defineSecret("R2_BUCKET_NAME");

const SNAPSHOT_KEY = "snapshots/shortcodes-v2.json";
const SCHEMA_VERSION = 3;
const BATCH_SIZE = 500;

interface SkinnyRecord {
  _id: string;
  encoded: string;
  payloadKind?: "solo";
  payloadTitle?: string;
  payloadStepCount?: number;
  payloadContentHash?: string;
  payloadSchemaVersion?: 3;
  authoredHand?: "left" | "right";
  sourceSoloPropId?: string;
  sequence?: string;
  sequenceName?: string;
}

function snapshotRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SkinnyRecord | null {
  if (typeof data.encoded !== "string" || data.encoded.length === 0) {
    return null;
  }
  const base: SkinnyRecord = { _id: id, encoded: data.encoded };
  if (data.payloadKind !== "solo") return base;
  return {
    ...base,
    payloadKind: "solo",
    payloadTitle: data.payloadTitle,
    payloadStepCount: data.payloadStepCount,
    payloadContentHash: data.payloadContentHash,
    payloadSchemaVersion: 3,
    authoredHand: data.authoredHand,
    ...(typeof data.sourceSoloPropId === "string" && {
      sourceSoloPropId: data.sourceSoloPropId,
    }),
    sequence: data.sequence,
    sequenceName: data.sequenceName,
  };
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
      const record = snapshotRecord(doc.id, doc.data());
      if (record) records.push(record);
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
    const rawMb = (Buffer.byteLength(body) / 1024 / 1024).toFixed(2);

    // Every phone that hits the fallback path pays for this transfer on cell
    // data, and R2 was serving it raw — no Content-Encoding, even when the
    // client advertised gzip. Measured on the live 2.35 MB snapshot: gzip -9
    // lands at 1.00 MB (2.4x). Not more, because the `encoded` blobs are
    // high-entropy base64. R2 returns the stored Content-Encoding header and
    // the browser inflates transparently, so `fetch(...).json()` in
    // short-code-manager needs no change.
    const gzipped = await gzipAsync(body, { level: 9 });
    const gzipMb = (gzipped.byteLength / 1024 / 1024).toFixed(2);
    const ratio = (Buffer.byteLength(body) / gzipped.byteLength).toFixed(1);
    console.log(
      `[snapshot] Built ${records.length} records (${rawMb} MB raw -> ${gzipMb} MB gzip, ${ratio}x)`
    );

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
        Body: gzipped,
        ContentType: "application/json",
        ContentEncoding: "gzip",
        CacheControl: "public, max-age=3600",
      })
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[snapshot] Uploaded r2://${bucket}/${SNAPSHOT_KEY} in ${elapsed}s`
    );
  });
