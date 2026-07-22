/**
 * Backfill the display word (`sequenceName` + `sequence`) on shortcode docs
 * that were minted with a junk auto-name.
 *
 * Root cause: unnamed sequences get an auto-name — "Sequence 2:21:45 PM"
 * (Construct), "Assemble Sequence" (Assemble), "Rotation …" (RotationDirection)
 * — and the old shortcode mint stored `sequence.word || sequence.name`. When
 * `word` was empty at mint, the auto-name got baked in, so the admin scan feed,
 * the card thumbnail, and the /q SSR/OG meta all showed the auto-name instead of
 * the TKA word. The mint path is fixed going forward (short-code-manager
 * `allocateCode`); this repairs the docs already written.
 *
 * The encoded blob carries no word and no letters — only motion — so the real
 * word is re-derived from the motions by matching each beat against the
 * pictograph dataframe (the same match `motion-query-handler` performs, done
 * directly over `parseCsvEdges` because the app's CSV loader is browser-only).
 *
 * Only auto-named docs are touched — deliberately user-named sequences are left
 * alone. A doc is repaired only when EVERY step derives a letter (a partial word
 * would misrepresent the sequence, so those are logged and skipped for manual
 * review).
 *
 * Writes require the Admin SDK: the client rules allow updating only
 * scanCount/lastScannedAt/dailyScans on a shortcode.
 *
 *   npx tsx scripts/migrations/backfill-shortcode-words.ts                       # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-shortcode-words.ts --apply   # write
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-shortcode-words.ts --apply --limit 5
 */
import { readFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import {
  parseCsvEdges,
  type CsvEdge,
} from "../../src/lib/features/choreo-card/services/pictograph-letter-lookup";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

type AnyRec = Record<string, unknown>;

const REPO_ROOT = "E:/tka-platform";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : Infinity;
})();

// Both dataframes, parsed once. deriveGridMode is browser-coupled, so match
// diamond first and fall back to box — a beat only lives in one, and the two
// alphabets don't collide on the same motion signature.
const csvPath = (name: string) =>
  join(REPO_ROOT, "static", "data", "pictographs", name);
const DIAMOND_EDGES = parseCsvEdges(
  readFileSync(csvPath("DiamondPictographDataframe.csv"), "utf8")
);
const BOX_EDGES = parseCsvEdges(
  readFileSync(csvPath("BoxPictographDataframe.csv"), "utf8")
);

const lc = (v: unknown): string => String(v ?? "").toLowerCase();

interface Motion {
  motionType?: string;
  startLocation?: string;
  endLocation?: string;
  rotationDirection?: string;
  prefloatMotionType?: string;
  prefloatRotationDirection?: string;
}

/** The letter-lookup motion type, mirroring motion-query-handler.getSearchMotionType:
 *  a float resolves through its prefloat type, or to a shift when it travels. */
function searchType(m: Motion): string {
  if (m.prefloatMotionType) return lc(m.prefloatMotionType);
  if (lc(m.motionType) === "float" && lc(m.startLocation) !== lc(m.endLocation)) {
    return "pro";
  }
  return lc(m.motionType);
}

/** Match a beat's two motions against one dataframe. Replicates the criteria in
 *  motion-query-handler.findLetterByMotionConfiguration: motionType + start/end
 *  location + rotation (rotation ignored for static/dash/unresolved-float), with
 *  the float→pro/anti alternative expansion. */
function matchIn(edges: CsvEdge[], blue: Motion, red: Motion): string | null {
  const blueFloat = lc(blue.motionType) === "float" && !blue.prefloatMotionType;
  const redFloat = lc(red.motionType) === "float" && !red.prefloatMotionType;
  const blueTypes =
    blueFloat && searchType(blue) === "pro" ? ["pro", "anti"] : [searchType(blue)];
  const redTypes =
    redFloat && searchType(red) === "pro" ? ["pro", "anti"] : [searchType(red)];
  const blueRot = lc(blue.prefloatRotationDirection || blue.rotationDirection);
  const redRot = lc(red.prefloatRotationDirection || red.rotationDirection);

  for (const bt of blueTypes) {
    for (const rt of redTypes) {
      const bIgnore = bt === "static" || bt === "dash" || blueFloat;
      const rIgnore = rt === "static" || rt === "dash" || redFloat;
      for (const e of edges) {
        if (
          lc(e.blueMotionType) === bt &&
          lc(e.blueStartLocation) === lc(blue.startLocation) &&
          lc(e.blueEndLocation) === lc(blue.endLocation) &&
          (bIgnore || lc(e.blueRotationDirection) === blueRot) &&
          lc(e.redMotionType) === rt &&
          lc(e.redStartLocation) === lc(red.startLocation) &&
          lc(e.redEndLocation) === lc(red.endLocation) &&
          (rIgnore || lc(e.redRotationDirection) === redRot)
        ) {
          return e.letter || null;
        }
      }
    }
  }
  return null;
}

function letterForBeat(step: AnyRec): string | null {
  if (typeof step.letter === "string" && step.letter) return step.letter;
  const motions = step.motions as { blue?: Motion; red?: Motion } | undefined;
  const blue = motions?.blue;
  const red = motions?.red;
  if (!blue || !red) return null;
  return matchIn(DIAMOND_EDGES, blue, red) ?? matchIn(BOX_EDGES, blue, red);
}

/** The auto-name generators, mirrored from the app: construct-tab-state
 *  (`Sequence <time>`), assemble-tab-state (`Assemble Sequence`),
 *  RotationDirectionView (`Rotation <time>`), and empty. Nothing else is
 *  touched, so a user's chosen name is never overwritten. */
function isAutoName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const n = name.trim();
  return (
    n === "" ||
    n === "Assemble Sequence" ||
    /^Sequence \d/.test(n) ||
    /^Rotation \d/.test(n)
  );
}

/** Build the full TKA word for a shortcode doc. Embedded steps may already carry
 *  letters; encoded-only docs get theirs matched from motion. Returns the raw
 *  (unsimplified) word — the display layer simplifies — and whether every step
 *  contributed a letter. */
async function wordForDoc(
  data: AnyRec
): Promise<{ word: string; complete: boolean } | null> {
  let steps: AnyRec[] | null = null;

  const embedded = data.sequenceData as
    | { steps?: unknown; beats?: unknown }
    | undefined;
  const embeddedSteps = embedded?.steps ?? embedded?.beats;
  if (Array.isArray(embeddedSteps) && embeddedSteps.length > 0) {
    steps = embeddedSteps as AnyRec[];
  } else if (typeof data.encoded === "string" && data.encoded) {
    const decoded = (await decodeSequenceFromQR(data.encoded)) as SequenceData;
    steps = (decoded.steps ?? []) as unknown as AnyRec[];
  }
  if (!steps || steps.length === 0) return null;

  const letters = steps.map((step) => letterForBeat(step));
  const complete = letters.every((l) => !!l);
  const word = letters.map((l) => l ?? "").join("");
  return { word, complete };
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
  };
  console.log(
    `via ${sdk} (admin=${isAdmin}) — ${APPLY ? "APPLY" : "DRY-RUN"}` +
      (LIMIT !== Infinity ? ` — limit ${LIMIT}` : "")
  );
  if (APPLY && !isAdmin) {
    throw new Error(
      "Writing sequenceName needs the Admin SDK — run with TKA_ADMIN=1."
    );
  }

  // Pass 1: cheap projection over every shortcode to find the junk-named ones.
  const nameSnap = await (db.collection as (p: string) => AnyRec)("shortcodes")[
    "select"
  ]("sequenceName", "sequence")["get"]();
  const junkCodes: string[] = [];
  for (const d of nameSnap.docs as Array<{
    id: string;
    get: (f: string) => unknown;
  }>) {
    const name = d.get("sequenceName") ?? d.get("sequence");
    if (isAutoName(name)) junkCodes.push(d.id);
  }
  console.log(
    `shortcodes scanned: ${nameSnap.size} | junk-named: ${junkCodes.length}`
  );

  // Pass 2: full doc per junk code → derive the real word → update.
  let fixed = 0,
    skippedPartial = 0,
    skippedNoWord = 0,
    failed = 0;
  let batch = (db.batch as () => AnyRec)();
  let batchCount = 0;

  const commitBatch = async () => {
    if (batchCount === 0) return;
    await (batch.commit as () => Promise<unknown>)();
    batch = (db.batch as () => AnyRec)();
    batchCount = 0;
  };

  const targets =
    LIMIT === Infinity ? junkCodes : junkCodes.slice(0, LIMIT);
  for (const code of targets) {
    const ref = (db.collection as (p: string) => AnyRec)("shortcodes")["doc"](
      code
    ) as AnyRec;
    let derived: { word: string; complete: boolean } | null = null;
    try {
      const snap = (await (ref.get as () => Promise<AnyRec>)()) as {
        data: () => AnyRec;
      };
      derived = await wordForDoc(snap.data());
    } catch (e) {
      failed++;
      console.log(`  ❌ ${code} — ${e instanceof Error ? e.message : e}`);
      continue;
    }

    if (!derived || !derived.word.trim()) {
      skippedNoWord++;
      console.log(`  ⚠️  ${code} — no derivable word, skip`);
      continue;
    }
    if (!derived.complete) {
      skippedPartial++;
      console.log(`  ⚠️  ${code} — partial word "${derived.word}", skip (manual)`);
      continue;
    }

    const word = derived.word;
    if (APPLY) {
      (batch.update as (r: AnyRec, u: AnyRec) => void)(ref, {
        sequenceName: word,
        sequence: word,
      });
      batchCount++;
      if (batchCount >= 400) await commitBatch();
    }
    fixed++;
    console.log(`  ${APPLY ? "✅" : "·"} ${code} → "${word}"`);
  }
  if (APPLY) await commitBatch();

  console.log(
    `\n${APPLY ? "fixed" : "would-fix"}=${fixed} ` +
      `skipped(partial)=${skippedPartial} skipped(no-word)=${skippedNoWord} ` +
      `failed=${failed}`
  );
  if (!APPLY) console.log("Re-run with TKA_ADMIN=1 … --apply to write.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
