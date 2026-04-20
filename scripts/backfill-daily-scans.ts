#!/usr/bin/env tsx
/**
 * One-shot backfill: for every shortcode doc, scan its scanEvents
 * subcollection and write a `dailyScans: { "YYYY-MM-DD": count }` map
 * back to the parent doc.
 *
 * Why this exists: the client-side `incrementScanCount` now writes
 * `dailyScans.<today>` on every scan, so the admin dashboard can render
 * 30-day sparklines from one doc read per code instead of fanning out
 * into each code's scanEvents subcollection. Historical codes scanned
 * before that change don't have the map populated — this fills it in.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-daily-scans.ts           (dry run — prints summary)
 *   npx tsx scripts/backfill-daily-scans.ts --confirm (actually write)
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

const dryRun = !process.argv.includes("--confirm");

interface BackfillRow {
  code: string;
  eventCount: number;
  daysFilled: number;
  dailyScans: Record<string, number>;
}

async function buildRollups(): Promise<BackfillRow[]> {
  const rows: BackfillRow[] = [];
  const shortcodesSnap = await db.collection("shortcodes").get();
  console.log(`[backfill] Walking ${shortcodesSnap.size} shortcode docs…`);

  let processed = 0;
  for (const shortcodeDoc of shortcodesSnap.docs) {
    processed++;
    if (processed % 200 === 0) {
      console.log(`[backfill]   …${processed}/${shortcodesSnap.size}`);
    }

    const eventsSnap = await shortcodeDoc.ref.collection("scanEvents").get();
    if (eventsSnap.empty) continue;

    const dailyScans: Record<string, number> = {};
    for (const eventDoc of eventsSnap.docs) {
      const raw = eventDoc.data().timestamp;
      if (typeof raw !== "string") continue;
      const day = raw.slice(0, 10); // "YYYY-MM-DDTHH..." -> "YYYY-MM-DD"
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      dailyScans[day] = (dailyScans[day] ?? 0) + 1;
    }

    if (Object.keys(dailyScans).length > 0) {
      rows.push({
        code: shortcodeDoc.id,
        eventCount: eventsSnap.size,
        daysFilled: Object.keys(dailyScans).length,
        dailyScans,
      });
    }
  }

  return rows;
}

async function writeRollups(rows: BackfillRow[]): Promise<void> {
  const BATCH_SIZE = 400;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + BATCH_SIZE)) {
      const ref = db.collection("shortcodes").doc(row.code);
      batch.update(ref, { dailyScans: row.dailyScans });
    }
    await batch.commit();
    console.log(
      `[backfill]   wrote batch ${Math.floor(i / BATCH_SIZE) + 1} ` +
        `(${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length})`
    );
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const rows = await buildRollups();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const totalEvents = rows.reduce((sum, r) => sum + r.eventCount, 0);
  const totalDays = rows.reduce((sum, r) => sum + r.daysFilled, 0);

  console.log("");
  console.log(`[backfill] Scanned in ${elapsed}s`);
  console.log(`[backfill]   codes with scan history: ${rows.length}`);
  console.log(`[backfill]   total scanEvents:        ${totalEvents}`);
  console.log(`[backfill]   total daily buckets:     ${totalDays}`);

  const topFive = [...rows].sort((a, b) => b.eventCount - a.eventCount).slice(0, 5);
  if (topFive.length > 0) {
    console.log("[backfill]   top 5 by scan count:");
    for (const r of topFive) {
      console.log(`[backfill]     ${r.code}  events=${r.eventCount}  days=${r.daysFilled}`);
    }
  }

  if (dryRun) {
    console.log("");
    console.log("[backfill] DRY RUN — no writes. Re-run with --confirm to apply.");
    return;
  }

  console.log("");
  console.log("[backfill] Writing rollups…");
  await writeRollups(rows);
  console.log("[backfill] Done.");
}

main().catch((err) => {
  console.error("[backfill] Failed:", err);
  process.exit(1);
});
