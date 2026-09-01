/**
 * Shared shortcode payload-word derivation (parity-repair spec, "Shortcode
 * correction"). Extracted from backfill-shortcode-words.ts so payload repairs
 * (rebuild-truncated-shortcode-payloads.ts) and future diagnostics derive
 * through the EXACT same code path the label repair used — the dataframe
 * matcher, the 0-based deck-blob renumbering, and the dual-source arbitration
 * are all load-bearing findings that must not fork.
 *
 * The payload is the authority: the `encoded` blob (falling back to embedded
 * `sequenceData.steps`) is decoded, each beat's letter is matched against the
 * pictograph dataframes (the same match `motion-query-handler` performs, done
 * directly over `parseCsvEdges` because the app's CSV loader is browser-only),
 * and the result runs through the shared STRICT word API
 * (`deriveWordStatusFromSteps`).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { decodeSequenceFromQR } from "../../../src/lib/shared/navigation/services/sequence-encoder";
import { deriveWordStatusFromSteps } from "../../../src/lib/shared/foundation/services/word-deriver";
import type { Step } from "@tka/tka-types";
import {
  parseCsvEdges,
  type CsvEdge,
} from "../../../src/lib/features/choreo-card/services/pictograph-letter-lookup";
import type { SequenceData } from "../../../src/lib/shared/foundation/domain/models/sequence-data";

export type AnyRec = Record<string, unknown>;

const REPO_ROOT = "E:/tka-platform";

// All three dataframes, parsed once. deriveGridMode is browser-coupled, so
// match diamond first, then box, then skewed — a beat only lives in one, and
// the alphabets don't collide on the same motion signature. Skewed is the
// mixed cardinal/intercardinal frame; without it, every skewed beat is
// underivable by construction.
const csvPath = (name: string) =>
  join(REPO_ROOT, "static", "data", "pictographs", name);
const DIAMOND_EDGES = parseCsvEdges(
  readFileSync(csvPath("DiamondPictographDataframe.csv"), "utf8")
);
const BOX_EDGES = parseCsvEdges(
  readFileSync(csvPath("BoxPictographDataframe.csv"), "utf8")
);
const SKEWED_EDGES = parseCsvEdges(
  readFileSync(csvPath("SkewedPictographDataframe.csv"), "utf8")
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

/** The rotation the letter lookup should match against.
 *
 *  DO NOT "recover" a float whose prefloatRotationDirection is the literal
 *  "noRotation". That signature means the blob predates prefloat fields:
 *  the legacy ENCODER wrote the float's own rotation ("noRotation") into the
 *  wire slot, and the legacy DECODER then FABRICATES prefloatMotionType via
 *  deriveMotionType(start, end, "noRotation") — an arbitrary value, not
 *  stored data (legacy-sequence-codec.ts:289). A handpath-based rotation
 *  recovery was tried here on 2026-07-27 and produced confident same-family
 *  wrong letters (proven against embedded mint-time witnesses on tgllYT /
 *  YOZG / kzkEp0: blob prefloat types flip pro↔anti arbitrarily). Such beats
 *  are honestly underivable — the information never entered the wire. */
function effectiveRotation(m: Motion): string {
  return lc(m.prefloatRotationDirection || m.rotationDirection);
}

/** Match a beat's two motions against one dataframe. Replicates the criteria
 *  in motion-query-handler.findLetterByMotionConfiguration — motionType +
 *  start/end location + rotation (rotation ignored for static/dash) — with
 *  CHANNEL-AWARE float handling. A float with no prefloat testimony expands
 *  to pro/anti alternatives with rotation ignored ONLY when
 *  `floatAlternatives` is set:
 *
 *  - EMBEDDED (mint/store-time) steps: allowed. An era of the app saved
 *    floats with no prefloat fields at all, and their letters — and the
 *    labels minted from them — were DEFINED by exactly this lookup at
 *    creation time (proven: qCE8jd-class records). The alternatives are the
 *    canonical semantics for that data, not a guess.
 *  - ENCODED (wire-decoded) steps: never. The legacy wire format DROPPED
 *    prefloat data the original sequence did have (proven: tgllYT's
 *    embedded carries pf pro/cw where its blob carries nothing), so
 *    alternatives-matching a decode guesses against lost information —
 *    same-family wrong letters with confidence. Those beats stay
 *    underivable and quarantine. */
function matchIn(
  edges: CsvEdge[],
  left: Motion,
  right: Motion,
  floatAlternatives: boolean
): string | null {
  const leftFloat = lc(left.motionType) === "float" && !left.prefloatMotionType;
  const rightFloat = lc(right.motionType) === "float" && !right.prefloatMotionType;
  if ((leftFloat || rightFloat) && !floatAlternatives) return null;
  const leftTypes =
    leftFloat && searchType(left) === "pro" ? ["pro", "anti"] : [searchType(left)];
  const rightTypes =
    rightFloat && searchType(right) === "pro" ? ["pro", "anti"] : [searchType(right)];
  const leftRot = effectiveRotation(left);
  const rightRot = effectiveRotation(right);

  for (const bt of leftTypes) {
    for (const rt of rightTypes) {
      const bIgnore = bt === "static" || bt === "dash" || leftFloat;
      const rIgnore = rt === "static" || rt === "dash" || rightFloat;
      for (const e of edges) {
        if (
          lc(e.leftMotionType) === bt &&
          lc(e.leftStartLocation) === lc(left.startLocation) &&
          lc(e.leftEndLocation) === lc(left.endLocation) &&
          (bIgnore || lc(e.leftRotationDirection) === leftRot) &&
          lc(e.rightMotionType) === rt &&
          lc(e.rightStartLocation) === lc(right.startLocation) &&
          lc(e.rightEndLocation) === lc(right.endLocation) &&
          (rIgnore || lc(e.rightRotationDirection) === rightRot)
        ) {
          return e.letter || null;
        }
      }
    }
  }
  return null;
}

export function letterForBeat(
  step: AnyRec,
  options?: { floatAlternatives?: boolean }
): string | null {
  if (typeof step.letter === "string" && step.letter) return step.letter;
  const motions = step.motions as { left?: Motion; right?: Motion } | undefined;
  const left = motions?.left;
  const right = motions?.right;
  if (!left || !right) return null;
  const floatAlternatives = options?.floatAlternatives ?? false;
  return (
    matchIn(DIAMOND_EDGES, left, right, floatAlternatives) ??
    matchIn(BOX_EDGES, left, right, floatAlternatives) ??
    matchIn(SKEWED_EDGES, left, right, floatAlternatives)
  );
}

export interface PayloadDerivation {
  word: string;
  complete: boolean;
  missingStepIndexes: readonly number[];
  stepCount: number;
  source: "encoded" | "embedded";
  /** Both payload sources derived complete, with the same beat count and the
   *  same word — the strongest evidence a stored label is simply wrong. */
  corroborated?: boolean;
}

// Deck-minted embedded blobs number their CONTENT beats 0-based, so the
// strict API's `stepNumber !== 0` start-entry filter would eat beat 0 and
// the word would lose its first letter (proven on 09PB: embedded letters
// "OTWΔ…"×4, naive derivation "TWΔO…"). A TRUE legacy start entry is
// letterless by design; a stepNumber-0 beat CARRYING a letter is 0-based
// content. Drop only a genuine leading start entry, then renumber the
// content beats 1..N so the strict API sees them all.
export function contentStepsOf(steps: AnyRec[]): AnyRec[] {
  const first = steps[0];
  const hasTrueStartEntry =
    first !== undefined &&
    first.stepNumber === 0 &&
    (first.letter ?? null) === null &&
    steps.length > 1 &&
    steps[1]!.stepNumber === 1;
  return hasTrueStartEntry ? steps.slice(1) : steps;
}

/** One entry per CONTENT beat (start-entry rule applied), each the beat's
 *  stored letter or dataframe match, null where neither resolves. This is the
 *  positional form deriveFromSteps collapses into a word — exposed so repairs
 *  can compare two payloads beat-by-beat instead of word-by-word. Defaults to
 *  the STRICT (no float alternatives) reading — evidence gates should never
 *  accept a guessed letter as agreement. */
export function contentLetters(
  steps: AnyRec[],
  options?: { floatAlternatives?: boolean }
): (string | null)[] {
  return contentStepsOf(steps).map((step) => letterForBeat(step, options));
}

export function deriveFromSteps(
  steps: AnyRec[],
  source: PayloadDerivation["source"]
): PayloadDerivation {
  const contentSteps = contentStepsOf(steps);

  // Channel-aware float semantics (see matchIn): mint-time embedded steps
  // may resolve prefloat-less floats through the app's canonical
  // alternatives lookup; wire decodes must not guess against information
  // the legacy format dropped.
  const floatAlternatives = source === "embedded";
  const lettered = contentSteps.map((step, index) => ({
    ...(step as object),
    stepNumber: index + 1,
    letter: letterForBeat(step, { floatAlternatives }),
  }));
  const status = deriveWordStatusFromSteps(lettered as unknown as Step[]);
  return {
    word: status.word,
    complete: status.complete,
    missingStepIndexes: status.missingStepIndexes,
    stepCount: status.stepCount,
    source,
  };
}

/**
 * Derive the payload word for a shortcode doc through the shared strict API
 * (`deriveWordStatusFromSteps` → { word, complete, missingStepIndexes,
 * stepCount }), so completeness and the content-beat count come from the SAME
 * strict code the runtime uses — never a local reimplementation. Beat letters
 * are filled by the dataframe match where the payload lacks them.
 *
 * BOTH payload sources are derived and the better one wins, because the
 * decode of old deck-minted blobs is LOSSY: their wire format carried
 * content-only beats, so the modern decoder consumes the first content beat
 * as the start position and the word loses its first letter (proven on 09PB:
 * embedded steps carry all 16 letters "OTWΔ…", the decode yields 15). A lossy
 * decode can only LOSE beats, never invent them, so:
 *
 *   - only one source derivable → use it
 *   - both complete → prefer MORE content beats; on equal counts the words
 *     must agree, otherwise the record is quarantined as a source conflict
 *   - both partial → report the one with fewer missing beats
 */
export async function derivePayloadWord(data: AnyRec): Promise<
  | PayloadDerivation
  | { conflict: { encoded: PayloadDerivation; embedded: PayloadDerivation } }
  | null
> {
  let fromEncoded: PayloadDerivation | null = null;
  if (typeof data.encoded === "string" && data.encoded) {
    try {
      const decoded = (await decodeSequenceFromQR(data.encoded)) as SequenceData;
      const decodedSteps = (decoded.steps ?? []) as unknown as AnyRec[];
      if (decodedSteps.length > 0) {
        fromEncoded = deriveFromSteps(decodedSteps, "encoded");
      }
    } catch {
      // A decoder rejection ("invalid start/end positions") must not mask a
      // healthy embedded payload.
    }
  }

  let fromEmbedded: PayloadDerivation | null = null;
  const embedded = data.sequenceData as
    | { steps?: unknown; beats?: unknown }
    | undefined;
  const embeddedSteps = embedded?.steps ?? embedded?.beats;
  if (Array.isArray(embeddedSteps) && embeddedSteps.length > 0) {
    fromEmbedded = deriveFromSteps(embeddedSteps as AnyRec[], "embedded");
  }

  if (!fromEncoded && !fromEmbedded) return null;
  if (!fromEncoded) return fromEmbedded;
  if (!fromEmbedded) return fromEncoded;

  if (fromEncoded.complete && fromEmbedded.complete) {
    if (fromEncoded.stepCount !== fromEmbedded.stepCount) {
      return fromEncoded.stepCount > fromEmbedded.stepCount
        ? fromEncoded
        : fromEmbedded;
    }
    if (fromEncoded.word === fromEmbedded.word) {
      return { ...fromEncoded, corroborated: true };
    }
    return { conflict: { encoded: fromEncoded, embedded: fromEmbedded } };
  }
  if (fromEncoded.complete) return fromEncoded;
  if (fromEmbedded.complete) return fromEmbedded;
  return fromEncoded.missingStepIndexes.length <=
    fromEmbedded.missingStepIndexes.length
    ? fromEncoded
    : fromEmbedded;
}

/** Matches the mint path's SHORTCODE_PAYLOAD_SCHEMA_VERSION in
 *  short-code-manager.ts: 2 = strict payload-derived labels. */
export const PAYLOAD_SCHEMA_VERSION = 2;
