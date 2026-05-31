#!/usr/bin/env node
/**
 * Re-seed ALL reversal variant decks from their continuous source decks.
 * Runs seed-reversal-decks.cjs for each source deck × all 5 patterns.
 *
 * Usage:
 *   node scripts/reseed-all-reversal-decks.cjs
 *   node scripts/reseed-all-reversal-decks.cjs --dry-run
 */

const { execSync } = require("child_process");
const path = require("path");
const admin = require("firebase-admin");

const DRY_RUN = process.argv.includes("--dry-run");
const PATTERNS = "book,red-book,blue-book,long-book,alternating";

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
const sa = require(serviceAccountPath);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const REVERSAL_SUFFIXES = ["-book", "-red-book", "-blue-book", "-long-book", "-alternating"];

async function main() {
  const snap = await db.collection("catalogs").get();
  const allIds = snap.docs.map((d) => d.id).sort();
  const sources = allIds.filter((id) => !REVERSAL_SUFFIXES.some((s) => id.endsWith(s)));

  console.log(`Found ${sources.length} source decks, ${allIds.length - sources.length} reversal decks`);
  console.log(`Patterns: ${PATTERNS}`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  const seederScript = path.join(__dirname, "seed-reversal-decks.cjs");
  let completed = 0;
  let failed = 0;

  for (const source of sources) {
    completed++;
    const label = `[${completed}/${sources.length}] ${source}`;
    console.log(`\n${"=".repeat(60)}`);
    console.log(label);
    console.log("=".repeat(60));

    const cmd = [
      "node",
      JSON.stringify(seederScript),
      "--source", source,
      "--patterns", PATTERNS,
      ...(DRY_RUN ? ["--dry-run"] : []),
    ].join(" ");

    try {
      const output = execSync(cmd, {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        timeout: 600_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      process.stdout.write(output);
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${err.stderr || err.message}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done! ${completed - failed}/${sources.length} succeeded, ${failed} failed`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
