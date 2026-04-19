#!/usr/bin/env tsx
/**
 * Real-time scan watcher.
 *
 * Attaches an onSnapshot listener to the `shortcodes` collection — no
 * ordering, no collection-group, no indexes required. Any time a doc
 * updates (scanCount / lastScannedAt bump), we detect it and pull the
 * freshest scanEvent from that specific code's subcollection.
 *
 * Usage: npx tsx scripts/watch-scans.ts
 * Exits on SIGINT.
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

function fmt(iso: string | undefined): string {
  if (!iso) return "?";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

async function main() {
  console.log("[watch-scans] bootstrapping baseline…");

  // Record current scanCount for every shortcode so the first snapshot
  // doesn't fire 2800 false-positive notifications.
  const prevCount = new Map<string, number>();
  const bootstrap = await db.collection("shortcodes").get();
  for (const d of bootstrap.docs) {
    const data = d.data();
    prevCount.set(d.id, typeof data.scanCount === "number" ? data.scanCount : 0);
  }
  console.log(`[watch-scans] baseline: ${prevCount.size} shortcodes tracked`);
  console.log("[watch-scans] 🟢 live. Scan a choreo card now — I'll see it within ~1s.\n");

  db.collection("shortcodes").onSnapshot(
    async (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== "modified") continue;
        const data = change.doc.data();
        const next = typeof data.scanCount === "number" ? data.scanCount : 0;
        const prev = prevCount.get(change.doc.id) ?? 0;
        if (next <= prev) continue;

        prevCount.set(change.doc.id, next);
        const code = change.doc.id;
        const word = typeof data.sequence === "string" ? data.sequence : "?";
        const lastScan = typeof data.lastScannedAt === "string" ? data.lastScannedAt : "";

        console.log(
          `\n🎉 SCAN DETECTED at ${fmt(lastScan)}\n` +
            `   code       : ${code}\n` +
            `   word       : ${word}\n` +
            `   scanCount  : ${prev} → ${next}\n`
        );

        // Also pull the freshest scanEvent from this code's subcollection
        // so we get user-agent / geo / referrer detail.
        try {
          const evtSnap = await db
            .collection("shortcodes")
            .doc(code)
            .collection("scanEvents")
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();
          const evt = evtSnap.docs[0]?.data();
          if (evt) {
            const loc = [evt.city, evt.country].filter(Boolean).join(", ") || "unknown";
            const ua = typeof evt.userAgent === "string" ? evt.userAgent.slice(0, 80) : "?";
            const ref = evt.referrer ?? "(direct)";
            const pid = evt.printId ?? "(none)";
            console.log(
              `   location   : ${loc}\n` +
                `   referrer   : ${ref}\n` +
                `   printId    : ${pid}\n` +
                `   userAgent  : ${ua}\n`
            );
          } else {
            console.log(`   (no scanEvent subdoc yet — may have been blocked by rules)\n`);
          }
        } catch (err) {
          console.log(`   (scanEvent lookup failed: ${err instanceof Error ? err.message : err})\n`);
        }
      }
    },
    (err) => {
      console.error("[watch-scans] listener error:", err);
      process.exit(1);
    }
  );

  process.on("SIGINT", () => {
    console.log("\n[watch-scans] exiting.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[watch-scans] fatal:", err);
  process.exit(1);
});
