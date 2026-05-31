/**
 * Release a TnD deck to Firestore
 *
 * Composes a deck from TnD catalogs filtered by turn pattern,
 * then writes a release manifest to deckReleases/counter/manifests.
 *
 * Usage:
 *   node scripts/release-tnd-deck.cjs                          # All symmetric whole-turn patterns
 *   node scripts/release-tnd-deck.cjs --patterns "uniform-0t,uniform-1t"  # Specific patterns
 *   node scripts/release-tnd-deck.cjs --notes "Whole Turn TnD" # Custom edition notes
 *   node scripts/release-tnd-deck.cjs --dry-run                # Preview without writing
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
const DRY_RUN = process.argv.includes("--dry-run");

const patternsArg = process.argv.find((a) => a.startsWith("--patterns"));
const patternsIdx = process.argv.indexOf("--patterns");
const PATTERNS = patternsIdx >= 0 && process.argv[patternsIdx + 1]
  ? new Set(process.argv[patternsIdx + 1].split(",").map((s) => s.trim()))
  : new Set(["uniform-0t", "uniform-1t", "uniform-2t", "uniform-3t"]);

const notesIdx = process.argv.indexOf("--notes");
const NOTES = notesIdx >= 0 && process.argv[notesIdx + 1]
  ? process.argv[notesIdx + 1]
  : "Whole Turn TnD";

const TND_ELEMENT_MAP = {
  "split-same":   { name: "Split-Same", iconPath: "/images/elements/water-v2.png" },
  "tog-same":     { name: "Tog-Same", iconPath: "/images/elements/earth-v2.png" },
  "quarter-same": { name: "Quarter-Same", iconPath: "/images/elements/sun-v4.png" },
  "split-opp":    { name: "Split-Opp", iconPath: "/images/elements/fire-v2.png" },
  "tog-opp":      { name: "Tog-Opp", iconPath: "/images/elements/air-v2.png" },
  "quarter-opp":  { name: "Quarter-Opp", iconPath: "/images/elements/moon-v2.png" },
};

let db;

try {
  const serviceAccount = require(serviceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  db = admin.firestore();
} catch (err) {
  console.error("Failed to initialize Firebase:", err.message);
  process.exit(1);
}

function formatTurnPattern(tp) {
  const uniform = tp.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniform) return `${uniform[1]}T (Symmetric)`;
  const pipe = tp.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (pipe) return `Blue ${pipe[1]} | Red ${pipe[2]}`;
  return tp;
}

async function main() {
  console.log("=== TnD Deck Release ===");
  console.log(`Turn patterns: ${[...PATTERNS].join(", ")}`);
  console.log(`Edition notes: ${NOTES}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  // 1. Load TnD catalogs
  const decksSnap = await db.collection("catalogs").get();
  const tndCatalogs = decksSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.collection === "TnD" && PATTERNS.has(c.turnPattern));

  console.log(`Found ${tndCatalogs.length} TnD catalogs matching patterns`);

  if (tndCatalogs.length === 0) {
    console.log("No matching catalogs. Available TnD turn patterns:");
    const allTnd = decksSnap.docs
      .map((d) => d.data())
      .filter((c) => c.collection === "TnD");
    const patterns = [...new Set(allTnd.map((c) => c.turnPattern))].sort();
    for (const p of patterns) {
      console.log(`  - ${p}`);
    }
    process.exit(1);
  }

  // 2. Build cards
  const cards = [];
  const patternCounts = {};
  // Collected for the stamped recipe (best-effort provenance for script decks).
  const recipeFamilyIds = new Set();
  const recipeTurnPatternIds = new Set();

  for (const catalog of tndCatalogs) {
    const tp = catalog.turnPattern;
    if (tp) recipeTurnPatternIds.add(tp);
    for (const family of catalog.families || []) {
      if (!family.id || family.id === "unknown") continue;
      recipeFamilyIds.add(family.id);
      const el = TND_ELEMENT_MAP[family.id];
      const footer = el
        ? { center: el.name, iconPath: el.iconPath }
        : { center: family.id };

      for (const seqId of family.sequenceIds || []) {
        cards.push({
          sequenceId: seqId,
          sourceCatalogId: catalog.id,
          stepCount: 4,
          word: seqId,
          position: 0,
          footer,
        });
        patternCounts[tp] = (patternCounts[tp] || 0) + 1;
      }
    }
  }

  // Assign positions
  cards.forEach((c, i) => { c.position = i + 1; });

  console.log(`\nDeck composition: ${cards.length} cards total`);
  for (const [tp, count] of Object.entries(patternCounts).sort()) {
    console.log(`  ${formatTurnPattern(tp)}: ${count} cards`);
  }

  // Show family breakdown
  const familyCounts = {};
  for (const card of cards) {
    const fam = card.footer.center;
    familyCounts[fam] = (familyCounts[fam] || 0) + 1;
  }
  console.log("\nBy family:");
  for (const [fam, count] of Object.entries(familyCounts).sort()) {
    console.log(`  ${fam}: ${count}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Would release this deck. Run without --dry-run to write.");
    console.log("\nSample cards:");
    for (const card of cards.slice(0, 6)) {
      console.log(`  #${card.position} ${card.word} (${card.footer.center})`);
    }
    process.exit(0);
  }

  // 3. Release to Firestore
  const counterRef = db.doc("deckReleases/counter");

  const release = await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const deckNumber = counterSnap.exists ? (counterSnap.data().next || 1) : 1;

    const distribution = {};
    for (const card of cards) {
      distribution[card.stepCount] = (distribution[card.stepCount] || 0) + 1;
    }

    const manifest = {
      deckNumber,
      createdAt: new Date().toISOString(),
      theme: "cosmic",
      cardCount: cards.length,
      notes: NOTES,
      sequences: cards,
      stepCountDistribution: distribution,
      // Deterministic recipe so script-released decks are reusable in the UI.
      recipe: {
        deckMode: "tnd",
        startOriModes: ["radial"],
        gridModes: ["diamond"],
        reversalPattern: null,
        tndFamilyIds: [...recipeFamilyIds],
        tndTurnPatternIds: [...recipeTurnPatternIds],
      },
    };

    const manifestRef = db.doc(`deckReleases/counter/manifests/${String(deckNumber).padStart(3, "0")}`);
    tx.set(manifestRef, manifest);
    tx.set(counterRef, { next: deckNumber + 1 }, { merge: true });

    return manifest;
  });

  console.log(`\nDeck #${String(release.deckNumber).padStart(3, "0")} released!`);
  console.log(`  ${release.cardCount} cards`);
  console.log(`  Notes: "${release.notes}"`);
  console.log(`  Created: ${release.createdAt}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
