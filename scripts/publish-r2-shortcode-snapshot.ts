/**
 * Build and (optionally) publish the R2 shortcode fallback snapshot ON DEMAND
 * — an ops mirror of the `snapshotShortCodes` Cloud Function
 * (firebase-functions/src/snapshotShortCodes.ts), for the moments a repair
 * batch just landed and waiting for the daily 03:00 UTC run would leave the
 * offline fallback serving pre-repair blobs.
 *
 * Byte-for-byte the same contract as the function: word records stay skinny
 * `{_id, encoded}` pairs; schema-3 solo records add only the envelope fields
 * needed to preserve their title, authored hand, and integrity checks during
 * an offline resolve. Docs without a non-empty `encoded` are skipped. The
 * envelope, gzip settings, object key, and headers match the scheduled
 * function. Only `_meta.source` differs.
 *
 *   TKA_ADMIN=1 npx tsx scripts/publish-r2-shortcode-snapshot.ts                    # build only
 *   TKA_ADMIN=1 npx tsx scripts/publish-r2-shortcode-snapshot.ts --upload           # build + wrangler put
 *   TKA_ADMIN=1 npx tsx scripts/publish-r2-shortcode-snapshot.ts --upload --verify  # + re-fetch and compare
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { gzipSync } from "zlib";
import { initFirestore } from "./lib/firestore-provider.js";

const SNAPSHOT_KEY = "snapshots/shortcodes-v2.json";
const BUCKET = "tka-assets";
const PUBLIC_URL = `https://pub-f5505ed75927471cb198c54336317370.r2.dev/${SNAPSHOT_KEY}`;
const SCHEMA_VERSION = 3;
const BATCH_SIZE = 500;

const argv = process.argv.slice(2);
const UPLOAD = argv.includes("--upload");
const VERIFY = argv.includes("--verify");

type AnyRec = Record<string, unknown>;

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
  data: Record<string, unknown>
): SkinnyRecord | null {
  if (typeof data.encoded !== "string" || data.encoded.length === 0) {
    return null;
  }
  const base: SkinnyRecord = { _id: id, encoded: data.encoded };
  if (data.payloadKind !== "solo") return base;
  return {
    ...base,
    payloadKind: "solo",
    payloadTitle: data.payloadTitle as string,
    payloadStepCount: data.payloadStepCount as number,
    payloadContentHash: data.payloadContentHash as string,
    payloadSchemaVersion: 3,
    authoredHand: data.authoredHand as "left" | "right",
    ...(typeof data.sourceSoloPropId === "string" && {
      sourceSoloPropId: data.sourceSoloPropId,
    }),
    sequence: data.sequence as string,
    sequenceName: data.sequenceName as string,
  };
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    sdk: string;
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("full-collection scan — run with TKA_ADMIN=1");
  console.log(`via ${sdk} — building skinny snapshot…`);

  const records: SkinnyRecord[] = [];
  let lastDoc: AnyRec | null = null;
  for (;;) {
    let q = (db.collection as (p: string) => AnyRec)("shortcodes")
      ["orderBy" as never]("__name__")
      ["limit" as never](BATCH_SIZE) as AnyRec;
    if (lastDoc) q = (q.startAfter as (d: AnyRec) => AnyRec)(lastDoc);
    const snap = (await (q.get as () => Promise<AnyRec>)()) as {
      empty: boolean;
      docs: Array<{ id: string; data(): Record<string, unknown> }>;
    };
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const record = snapshotRecord(doc.id, doc.data());
      if (record) records.push(record);
    }
    lastDoc = snap.docs[snap.docs.length - 1] as unknown as AnyRec;
    if (snap.docs.length < BATCH_SIZE) break;
  }

  const exportedAt = new Date().toISOString();
  const envelope = {
    _meta: {
      exportedAt,
      schemaVersion: SCHEMA_VERSION,
      collection: "shortcodes",
      documentCount: records.length,
      source: "manual publish (scripts/publish-r2-shortcode-snapshot.ts)",
    },
    documents: records,
  };
  const body = JSON.stringify(envelope);
  const gzipped = gzipSync(body, { level: 9 });
  const stamp = exportedAt.replace(/[:.]/g, "-");
  const outPath = join(
    "scripts",
    "migrations",
    "backups",
    `shortcodes-v2-${stamp}.json.gz`
  );
  writeFileSync(outPath, gzipped);
  console.log(
    `built ${records.length} records (${(Buffer.byteLength(body) / 1024 / 1024).toFixed(2)} MB raw → ${(gzipped.byteLength / 1024 / 1024).toFixed(2)} MB gzip) → ${outPath}`
  );

  if (!UPLOAD) {
    console.log("build-only run. Re-run with --upload to publish to R2.");
    process.exit(0);
  }

  // execSync (one shell string) rather than execFileSync("npx", [...]) —
  // npx is a .cmd shim on Windows, and execFileSync's shell/arg handling
  // aborts (0xC0000409) instead of running it. Every interpolated value here
  // is script-owned; nothing user-controlled reaches the shell.
  execSync(
    `npx wrangler r2 object put "${BUCKET}/${SNAPSHOT_KEY}" --file "${outPath}" ` +
      `--content-type "application/json" --content-encoding "gzip" ` +
      `--cache-control "public, max-age=3600" --remote`,
    { stdio: "inherit" }
  );
  console.log(`uploaded r2://${BUCKET}/${SNAPSHOT_KEY}`);

  if (VERIFY) {
    // Query param busts the r2.dev cache so we read the object just written,
    // not the CDN's copy of the previous export.
    const res = await fetch(`${PUBLIC_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`verify fetch failed: HTTP ${res.status}`);
    const fetched = (await res.json()) as typeof envelope;
    const sameExport = fetched._meta.exportedAt === exportedAt;
    const sameCount =
      fetched._meta.documentCount === records.length &&
      fetched.documents.length === records.length;
    console.log(
      `verify: exportedAt ${fetched._meta.exportedAt} (${sameExport ? "MATCHES upload" : "STALE — CDN cache?"}), ` +
        `declared ${fetched._meta.documentCount} / actual ${fetched.documents.length} (${sameCount ? "MATCHES" : "MISMATCH"})`
    );
    if (!sameExport || !sameCount) process.exit(2);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
