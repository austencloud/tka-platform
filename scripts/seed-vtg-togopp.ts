/**
 * Re-seed the 3 tog-opp VTG base sequences with MIRROR chirality.
 *
 * Background: the 3 "tog-opp" halved LOOP decks (DJ/DJDJ, EK/EKEK, FL/FLFL)
 * start at beta5. Production was seeded with the natural chirality
 * (beta5 -> alpha7 -> beta1 -> alpha3 -> beta5, blue leading CCW for DJ).
 * Austen wants the MIRROR chirality as the canonical base:
 *   beta5 -> alpha3 -> beta1 -> alpha7 -> beta5, blue leading CW for DJ.
 *
 * Why a dedicated generator instead of the general seed-vtg-deck.ts path:
 * that seeder routes through the function-based executeLOOP ->
 * executeStrictRotated -> createRotatedStep in
 * packages/sequence-engine/src/loop/execution/LOOPExecutor.ts. That path reads
 * `step.motions.{blue,red}` while the seeder builds flat blueMotion/redMotion
 * steps, so it throws "Cannot read properties of undefined (reading 'blue')"
 * for ALL 19 VTG seeds. That function path is dead at runtime: the app uses the
 * class-based StrictRotatedExecutor, and the active MCP server (mcp-server-pkg,
 * per .mcp.json) routes executeLOOP through core/loop/loop-adapter.ts, which
 * converts flat<->nested and calls the class executors. Reviving the function
 * path would touch dead code and still require rewriting the seeder's step
 * shape, so instead this script walks the canonical CSV directly for just the 3
 * tog-opp decks. Each beat is a unique (letter, startPos, endPos) CSV row
 * (verified), chains orientations through the engine's OrientationCalculator,
 * and updates ONLY the 3 base docs in place. The other 16 VTG sequences are
 * untouched. The CSV (DiamondPictographDataframe.csv) is master truth and is
 * never reordered or edited.
 *
 * Usage: npx tsx scripts/seed-vtg-togopp.ts [--dry-run]
 * Requires: serviceAccountKey.json in project root
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { calculateEndOrientation } from "../packages/sequence-engine/src/core/orientation/OrientationCalculator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.resolve(
  PROJECT_ROOT,
  "static/data/pictographs/DiamondPictographDataframe.csv"
);
const SERVICE_ACCOUNT_PATH = path.resolve(PROJECT_ROOT, "serviceAccountKey.json");
const DECK_ID = "l1-vtg-motions";
const DRY_RUN = process.argv.includes("--dry-run");
const PREVIEW_PATH = path.resolve(PROJECT_ROOT, "togopp-preview.txt");

// ============================================================================
// CSV ROW MODEL
// ============================================================================

interface CsvMotion {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
}

interface CsvRow {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blue: CsvMotion;
  red: CsvMotion;
}

function loadCsv(): CsvRow[] {
  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = content.trim().split("\n");
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(",").map((s) => s.trim());
    if (!v[0]) continue;
    rows.push({
      letter: v[0],
      startPosition: v[1],
      endPosition: v[2],
      timing: v[3],
      direction: v[4],
      blue: { motionType: v[5], rotationDirection: v[6], startLocation: v[7], endLocation: v[8] },
      red: { motionType: v[9], rotationDirection: v[10], startLocation: v[11], endLocation: v[12] },
    });
  }
  return rows;
}

// ============================================================================
// MIRROR-CHIRALITY 4-BEAT DEFINITIONS
//
// Each beat is identified by (letter, startPos, endPos). That triple resolves
// to exactly one CSV row for every beat below (verified against the canonical
// CSV), including the hybrid F/L rows where blue=anti, red=pro is preserved.
// Walk: beta5 -> alpha3 -> beta1 -> alpha7 -> beta5
// ============================================================================

interface BeatRef {
  letter: string;
  startPos: string;
  endPos: string;
  /**
   * Blue rotationDirection discriminator. Hybrid letters (F, L) have TWO
   * pictographs per (letter, startPos, endPos) differing in which hand is anti
   * vs pro. blueDir breaks that tie. For the mirror chirality FL beats we want
   * blue=anti/ccw, red=pro/ccw — i.e. blueDir "ccw" — which preserves the
   * production hand assignment (blue=anti, red=pro). DJ/EK are symmetric (both
   * hands the same motion type) so the triple is already unique; blueDir is
   * omitted there.
   */
  blueDir?: string;
}

interface TogOppDeckDef {
  seqId: string;
  word: string;
  beats: BeatRef[];
}

const TOG_OPP_DECKS: TogOppDeckDef[] = [
  {
    seqId: "vtg-tog-opp-djdj",
    word: "DJDJ",
    beats: [
      { letter: "D", startPos: "beta5", endPos: "alpha3" },
      { letter: "J", startPos: "alpha3", endPos: "beta1" },
      { letter: "D", startPos: "beta1", endPos: "alpha7" },
      { letter: "J", startPos: "alpha7", endPos: "beta5" },
    ],
  },
  {
    seqId: "vtg-tog-opp-ekek",
    word: "EKEK",
    beats: [
      { letter: "E", startPos: "beta5", endPos: "alpha3" },
      { letter: "K", startPos: "alpha3", endPos: "beta1" },
      { letter: "E", startPos: "beta1", endPos: "alpha7" },
      { letter: "K", startPos: "alpha7", endPos: "beta5" },
    ],
  },
  {
    seqId: "vtg-tog-opp-flfl",
    word: "FLFL",
    beats: [
      { letter: "F", startPos: "beta5", endPos: "alpha3", blueDir: "ccw" },
      { letter: "L", startPos: "alpha3", endPos: "beta1", blueDir: "ccw" },
      { letter: "F", startPos: "beta1", endPos: "alpha7", blueDir: "ccw" },
      { letter: "L", startPos: "alpha7", endPos: "beta5", blueDir: "ccw" },
    ],
  },
];

function findRow(rows: CsvRow[], b: BeatRef): CsvRow {
  const matches = rows.filter(
    (r) =>
      r.letter === b.letter &&
      r.startPosition === b.startPos &&
      r.endPosition === b.endPos &&
      (b.blueDir === undefined || r.blue.rotationDirection === b.blueDir)
  );
  if (matches.length === 0) {
    const dir = b.blueDir ? ` blueDir=${b.blueDir}` : "";
    throw new Error(`No CSV row for ${b.letter} ${b.startPos}>${b.endPos}${dir}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous CSV rows (${matches.length}) for ${b.letter} ${b.startPos}>${b.endPos}` +
        `${b.blueDir ? ` blueDir=${b.blueDir}` : ""}; add a blueDir discriminator`
    );
  }
  return matches[0];
}

// ============================================================================
// ORIENTATION CHAINING (mirrors chainOrientations in seed-vtg-deck.ts)
// ============================================================================

interface BuiltMotion extends CsvMotion {
  startOrientation: string;
  endOrientation: string;
}

interface BuiltBeat {
  letter: string;
  startPosition: string;
  endPosition: string;
  blue: BuiltMotion;
  red: BuiltMotion;
}

function chainOrientations(rows: CsvRow[]): BuiltBeat[] {
  let blueOri = "in";
  let redOri = "in";
  return rows.map((r) => {
    const blueStart = blueOri;
    const redStart = redOri;
    const blueEnd = calculateEndOrientation({
      motionType: r.blue.motionType,
      turns: 0,
      rotationDirection: r.blue.rotationDirection || "cw",
      startLocation: r.blue.startLocation,
      endLocation: r.blue.endLocation,
      startOrientation: blueStart,
    });
    const redEnd = calculateEndOrientation({
      motionType: r.red.motionType,
      turns: 0,
      rotationDirection: r.red.rotationDirection || "cw",
      startLocation: r.red.startLocation,
      endLocation: r.red.endLocation,
      startOrientation: redStart,
    });
    blueOri = blueEnd;
    redOri = redEnd;
    return {
      letter: r.letter,
      startPosition: r.startPosition,
      endPosition: r.endPosition,
      blue: { ...r.blue, startOrientation: blueStart, endOrientation: blueEnd },
      red: { ...r.red, startOrientation: redStart, endOrientation: redEnd },
    };
  });
}

function computeHandPathId(beats: BuiltBeat[]): string {
  const blue = [beats[0].blue.startLocation, ...beats.map((b) => b.blue.endLocation)].join("→");
  const red = [beats[0].red.startLocation, ...beats.map((b) => b.red.endLocation)].join("→");
  return [blue, red].sort().join("|");
}

// ============================================================================
// FIRESTORE MOTION SHAPE (mirrors buildFirestoreMotion in seed-vtg-deck.ts)
// ============================================================================

function fsMotion(m: BuiltMotion, color: string) {
  return {
    motionType: m.motionType,
    rotationDirection: m.rotationDirection,
    startLocation: m.startLocation,
    endLocation: m.endLocation,
    turns: 0,
    startOrientation: m.startOrientation,
    endOrientation: m.endOrientation,
    color,
    propType: "staff",
    gridMode: "diamond",
    isVisible: true,
    arrowLocation: m.endLocation,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log("=== Tog-Opp Mirror-Chirality Re-Seed ===\n");
  const rows = loadCsv();
  console.log(`Loaded ${rows.length} CSV pictograph rows\n`);

  const built = TOG_OPP_DECKS.map((deck) => {
    const csvRows = deck.beats.map((b) => findRow(rows, b));
    const beats = chainOrientations(csvRows);
    const handPathId = computeHandPathId(beats);
    return { deck, beats, handPathId };
  });

  // Human-readable preview
  const lines: string[] = [];
  for (const { deck, beats, handPathId } of built) {
    lines.push(`=== ${deck.seqId} (${deck.word}) ===`);
    lines.push(`handPathId=${handPathId}`);
    beats.forEach((b, i) => {
      const mfmt = (m: BuiltMotion) =>
        `${m.motionType}/${m.rotationDirection} ${m.startLocation}>${m.endLocation} ` +
        `ori ${m.startOrientation}>${m.endOrientation}`;
      lines.push(
        `  b${i + 1}: ${b.letter} ${b.startPosition}>${b.endPosition} | blue ${mfmt(b.blue)} | red ${mfmt(b.red)}`
      );
    });
    lines.push("");
  }
  const preview = lines.join("\n");
  console.log(preview);
  fs.writeFileSync(PREVIEW_PATH, preview, "utf-8");
  console.log(`Preview written to ${PREVIEW_PATH}`);

  if (DRY_RUN) {
    console.log("\n--- DRY RUN — no Firestore write ---");
    return;
  }

  const admin = await import("firebase-admin");
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  if (!admin.default.apps.length) {
    admin.default.initializeApp({ credential: admin.default.credential.cert(serviceAccount) });
  }
  const db = admin.default.firestore();

  for (const { deck, beats, handPathId } of built) {
    const ref = db.doc(`decks/${DECK_ID}/sequences/${deck.seqId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.error(`  SKIP ${deck.seqId}: doc does not exist`);
      continue;
    }
    const data = snap.data()!;

    // Build new steps, reusing existing step ids where present so downstream
    // references stay stable.
    const oldSteps: any[] = Array.isArray(data.steps) ? data.steps : [];
    const newSteps = beats.map((b, i) => {
      const old = oldSteps[i] ?? {};
      return {
        id: old.id ?? `${deck.seqId}-step-${i + 1}`,
        isStep: true,
        stepNumber: i + 1,
        letter: b.letter,
        startPosition: b.startPosition,
        endPosition: b.endPosition,
        gridMode: "diamond",
        duration: 1.0,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
        motions: {
          blue: fsMotion(b.blue, "blue"),
          red: fsMotion(b.red, "red"),
        },
      };
    });

    // Start position stays beta5 but uses beat-1 start locations so the static
    // start matches the walk's opening hand placement.
    const first = beats[0];
    const oldStart = data.startPosition ?? {};
    const newStart = {
      ...oldStart,
      isStartPosition: true,
      gridPosition: first.startPosition,
      gridMode: "diamond",
      motions: {
        blue: fsMotion(
          {
            motionType: "static",
            rotationDirection: "noRotation",
            startLocation: first.blue.startLocation,
            endLocation: first.blue.startLocation,
            startOrientation: "in",
            endOrientation: "in",
          },
          "blue"
        ),
        red: fsMotion(
          {
            motionType: "static",
            rotationDirection: "noRotation",
            startLocation: first.red.startLocation,
            endLocation: first.red.startLocation,
            startOrientation: "in",
            endOrientation: "in",
          },
          "red"
        ),
      },
    };

    const newMetadata = {
      ...(data.metadata ?? {}),
      handPathId,
    };

    await ref.update({
      steps: newSteps,
      startPosition: newStart,
      metadata: newMetadata,
    });
    console.log(`  Updated ${deck.seqId} (handPathId=${handPathId})`);
  }

  console.log("\nDone. Updated 3 tog-opp base sequences in place.");
}

main().catch((err) => {
  console.error("Re-seed failed:", err);
  process.exit(1);
});
