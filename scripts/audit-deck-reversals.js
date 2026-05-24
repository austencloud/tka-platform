#!/usr/bin/env node
/**
 * Deck Reversal Audit
 *
 * Scans all sequences across all LOOP decks for hidden reversals —
 * direction changes that span static/dash gaps (e.g. cw → noRot → noRot → ccw).
 *
 * Usage:
 *   node scripts/audit-deck-reversals.js
 *   node scripts/audit-deck-reversals.js --deck=DECK_ID
 *   node scripts/audit-deck-reversals.js --fix   (removes reversal sequences from deck families)
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const args = process.argv.slice(2);
const deckArg = args.find((a) => a.startsWith("--deck="));
const targetDeckId = deckArg ? deckArg.split("=")[1] : null;
const fixMode = args.includes("--fix");

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const DELAY_MS = 500;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Reversal detection (mirrors src/lib/shared/create/services/reversal-detector.ts)
// ---------------------------------------------------------------------------

function getMotion(step, color) {
  if (!step) return null;
  const motions = step.motions || step.motion;
  if (!motions) return null;
  return motions[color] || null;
}

function getPropRotDir(step, color) {
  if (!step) return null;
  const motion = getMotion(step, color);
  if (!motion) return null;

  if (motion.rotationDirection) return motion.rotationDirection;

  if (motion.motionType === "static" || motion.motionType === "dash") {
    return "noRotation";
  }

  return "cw"; // fallback for malformed data
}

function getLastValidPropRotDir(steps, color) {
  for (let i = steps.length - 1; i >= 0; i--) {
    const dir = getPropRotDir(steps[i], color);
    if (dir && dir !== "noRotation") return dir;
  }
  return null;
}

function isReversal(last, current) {
  if (!last || !current || last === "noRotation" || current === "noRotation") {
    return false;
  }
  return last !== current;
}

function detectReversals(seq) {
  const steps = seq.steps || seq.beats || [];
  if (steps.length === 0) return [];

  const isLoop = !!seq.loopType || !!seq.isCircular;
  const reversals = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    let previousSteps;
    if (isLoop) {
      previousSteps = [...steps, ...steps.slice(0, i)];
    } else {
      previousSteps = steps.slice(0, i);
    }

    for (const color of ["blue", "red"]) {
      const lastDir = getLastValidPropRotDir(previousSteps, color);
      const currentDir = getPropRotDir(step, color);

      if (isReversal(lastDir, currentDir)) {
        const stepNum = step.stepNumber ?? step.beat ?? i + 1;
        reversals.push({
          step: stepNum,
          color,
          from: lastDir,
          to: currentDir,
        });
      }
    }
  }

  return reversals;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Deck Reversal Audit ===\n");

  const decksSnap = await db.collection("decks").get();
  const allDecks = decksSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.collection === "LOOPs");

  const decksToScan = targetDeckId
    ? allDecks.filter((d) => d.id === targetDeckId)
    : allDecks;

  if (decksToScan.length === 0) {
    console.log("No matching decks found.");
    return;
  }

  console.log(`Scanning ${decksToScan.length} LOOP deck(s)...\n`);

  let totalSequences = 0;
  let totalReversals = 0;
  const allBadSequences = [];

  for (const deck of decksToScan) {
    console.log(`--- ${deck.name} (${deck.id}) ---`);
    console.log(`    turnPattern: ${deck.turnPattern}, level: ${deck.level}`);

    const seqsSnap = await db
      .collection("decks")
      .doc(deck.id)
      .collection("sequences")
      .get();

    const sequences = seqsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    totalSequences += sequences.length;

    const badSeqs = [];

    for (const seq of sequences) {
      const reversals = detectReversals(seq);
      if (reversals.length > 0) {
        badSeqs.push({ seqId: seq.id, word: seq.word || seq.id, reversals });
      }
    }

    if (badSeqs.length > 0) {
      totalReversals += badSeqs.length;
      console.log(`    ⚠ ${badSeqs.length} / ${sequences.length} have reversals:`);
      for (const bad of badSeqs) {
        const details = bad.reversals
          .map((r) => `step ${r.step} ${r.color} ${r.from}→${r.to}`)
          .join(", ");
        console.log(`      ${bad.word}: ${details}`);
      }
      allBadSequences.push(
        ...badSeqs.map((b) => ({ ...b, deckId: deck.id, deckName: deck.name }))
      );
    } else {
      console.log(`    ✓ ${sequences.length} sequences — all clean`);
    }

    await sleep(DELAY_MS);
  }

  console.log("\n=== Summary ===");
  console.log(`Total sequences scanned: ${totalSequences}`);
  console.log(`Sequences with reversals: ${totalReversals}`);

  if (totalReversals === 0) {
    console.log("\nAll clean — no hidden reversals found.");
    return;
  }

  if (!fixMode) {
    console.log(
      `\nRun with --fix to remove these ${totalReversals} sequences from their deck families.`
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Fix mode: remove reversal sequences from deck families
  // ---------------------------------------------------------------------------

  console.log(`\n=== Fixing: removing ${totalReversals} reversal sequences from deck families ===\n`);

  const badByDeck = new Map();
  for (const bad of allBadSequences) {
    if (!badByDeck.has(bad.deckId)) badByDeck.set(bad.deckId, new Set());
    badByDeck.get(bad.deckId).add(bad.seqId);
  }

  for (const [deckId, badIds] of badByDeck) {
    const deckRef = db.collection("decks").doc(deckId);
    const deckDoc = await deckRef.get();
    const deckData = deckDoc.data();

    const families = deckData.families || [];
    let removed = 0;

    const updatedFamilies = families.map((fam) => {
      const original = fam.sequenceIds || [];
      const filtered = original.filter((id) => !badIds.has(id));
      removed += original.length - filtered.length;
      return { ...fam, sequenceIds: filtered };
    });

    const newTotal = updatedFamilies.reduce(
      (sum, f) => sum + (f.sequenceIds?.length || 0),
      0
    );

    await deckRef.update({
      families: updatedFamilies,
      totalSequences: newTotal,
    });

    console.log(
      `  ${deckId}: removed ${removed} sequence(s), ${newTotal} remaining`
    );

    await sleep(DELAY_MS);
  }

  console.log("\nDone. Reversal sequences removed from deck families.");
  console.log(
    "Note: sequence documents still exist in subcollections — only family references removed."
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
