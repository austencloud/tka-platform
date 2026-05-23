#!/usr/bin/env node
/**
 * Fix VTG Deck Orientation Data
 *
 * Recalculates endOrientation for every step in affected VTG deck sequences
 * using the canonical orientation calculator logic:
 *   PRO/STATIC: even turns = same, odd turns = switch
 *   ANTI/DASH:  even turns = switch, odd turns = same
 *
 * Usage:
 *   node scripts/fix-vtg-orientations.js --dry-run     # Preview changes
 *   node scripts/fix-vtg-orientations.js               # Apply fixes to Firestore
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const SWITCH_MAP = {
  in: "out",
  out: "in",
  clock: "counter",
  counter: "clock",
  clockIn: "counterOut",
  counterOut: "clockIn",
  clockOut: "counterIn",
  counterIn: "clockOut",
  centerN: "centerS",
  centerS: "centerN",
  centerNE: "centerSW",
  centerSW: "centerNE",
  centerE: "centerW",
  centerW: "centerE",
  centerSE: "centerNW",
  centerNW: "centerSE",
};

function switchOrientation(ori) {
  return SWITCH_MAP[ori] || ori;
}

function calculateEndOrientation(motionType, turns, startOrientation) {
  const type = (motionType || "static").toLowerCase();
  const t = typeof turns === "number" ? turns : 0;

  if (!Number.isInteger(t)) {
    // Fractional turns need rotation direction — skip for now, only fix whole-turn cases
    return null;
  }

  const isEvenTurns = t % 2 === 0;

  if (type === "pro" || type === "static") {
    return isEvenTurns ? startOrientation : switchOrientation(startOrientation);
  } else if (type === "anti" || type === "dash") {
    return isEvenTurns ? switchOrientation(startOrientation) : startOrientation;
  }

  return startOrientation;
}

const COLORS = ["blue", "red"];
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAllDecks() {
  const snapshot = await db.collection("decks").get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fixDeck(deck) {
  const seqPath = `decks/${deck.id}/sequences`;
  const snapshot = await db.collection(seqPath).get();
  const sequences = snapshot.docs;

  let fixedCount = 0;
  let errorCount = 0;

  for (const doc of sequences) {
    const seq = doc.data();
    const steps = seq.steps || seq.beats || [];
    const startPos = seq.startPosition || seq.start_position || null;

    if (steps.length === 0) continue;

    let needsFix = false;
    const fixedSteps = [];

    // Build the orientation chain: startPosition → step1 → step2 → ...
    let prevEndOri = {};
    if (startPos) {
      for (const color of COLORS) {
        const m = startPos.motions?.[color];
        if (m) {
          prevEndOri[color] = m.endOrientation || m.end_orientation;
        }
      }
    }

    for (let i = 0; i < steps.length; i++) {
      const step = { ...steps[i] };
      const motions = { ...step.motions };
      let stepChanged = false;

      for (const color of COLORS) {
        if (!motions[color]) continue;
        const motion = { ...motions[color] };

        // Fix 1: Propagate startOrientation from previous step's endOrientation
        const expectedStartOri = prevEndOri[color];
        if (expectedStartOri && motion.startOrientation !== expectedStartOri) {
          motion.startOrientation = expectedStartOri;
          stepChanged = true;
        }

        // Fix 2: Recalculate endOrientation from the (corrected) startOrientation
        const correctEndOri = calculateEndOrientation(
          motion.motionType,
          motion.turns,
          motion.startOrientation
        );

        if (correctEndOri !== null && motion.endOrientation !== correctEndOri) {
          motion.endOrientation = correctEndOri;
          stepChanged = true;
        }

        motions[color] = motion;

        // Track for next step
        prevEndOri[color] = motion.endOrientation;
      }

      if (stepChanged) {
        needsFix = true;
        step.motions = motions;
      }
      fixedSteps.push(step);
    }

    if (needsFix) {
      fixedCount++;

      if (isDryRun) {
        // Show what would change
        const word = seq.word || seq.name || doc.id;
        console.log(`  Would fix: ${word} (${doc.id})`);

        // Show the orientation chain
        for (const color of COLORS) {
          const origSteps = steps;
          const chain = [];
          const sp = startPos?.motions?.[color];
          if (sp) chain.push(`start=${sp.startOrientation}`);
          for (let i = 0; i < origSteps.length; i++) {
            const m = origSteps[i].motions?.[color];
            if (m) chain.push(`s${i + 1}:${m.startOrientation}→${m.endOrientation}`);
          }
          const fixedChain = [];
          if (sp) fixedChain.push(`start=${sp.startOrientation}`);
          for (let i = 0; i < fixedSteps.length; i++) {
            const m = fixedSteps[i].motions?.[color];
            if (m) fixedChain.push(`s${i + 1}:${m.startOrientation}→${m.endOrientation}`);
          }
          console.log(`    ${color} before: ${chain.join(" | ")}`);
          console.log(`    ${color} after:  ${fixedChain.join(" | ")}`);
        }
      } else {
        try {
          await db.collection(seqPath).doc(doc.id).update({ steps: fixedSteps });
        } catch (err) {
          console.error(`  ERROR updating ${doc.id}: ${err.message}`);
          errorCount++;
        }
      }
    }
  }

  return { total: sequences.length, fixed: fixedCount, errors: errorCount };
}

async function main() {
  console.log(`=== VTG Orientation Fix ${isDryRun ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  const decks = await loadAllDecks();
  console.log(`Found ${decks.length} decks.\n`);

  // Only process VTG decks — LOOP decks passed the audit clean
  const vtgDecks = decks.filter((d) => {
    const id = d.id || "";
    const name = (d.name || "").toLowerCase();
    return id.includes("vtg") || name.includes("vtg");
  });

  console.log(`Filtering to ${vtgDecks.length} VTG decks (LOOP decks passed audit clean).\n`);

  let totalFixed = 0;
  let totalScanned = 0;
  let totalErrors = 0;

  for (const deck of vtgDecks) {
    const name = deck.name || deck.id;
    const { total, fixed, errors } = await fixDeck(deck);
    totalScanned += total;
    totalFixed += fixed;
    totalErrors += errors;

    if (fixed > 0) {
      console.log(`${isDryRun ? "Would fix" : "Fixed"} ${fixed}/${total} in ${name}`);
    } else if (total > 0) {
      console.log(`✅ ${name}: ${total} sequences OK`);
    }

    await sleep(DELAY_MS);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Sequences scanned: ${totalScanned}`);
  console.log(`Sequences ${isDryRun ? "would fix" : "fixed"}: ${totalFixed}`);
  if (totalErrors > 0) {
    console.log(`Errors: ${totalErrors}`);
  }

  // Also fix shortcode embedded data for affected sequences
  if (!isDryRun && totalFixed > 0) {
    console.log("\nNote: Shortcode embedded sequenceData may also need updating.");
    console.log("Run the audit again after this fix to verify all clear.");
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Fix script failed:", err);
  process.exit(1);
});
