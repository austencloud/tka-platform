/**
 * sequence-content-hasher - Computes a deterministic SHA-256 hash from motion content
 *
 * The hash is the sequence's identity as a physical movement pattern.
 * Same hash = same variation. Different hash = different variation.
 *
 * Only motion-defining fields contribute to the hash. Everything that's a user
 * annotation (name, tags, visibility, thumbnails) is excluded.
 *
 * ## Hash versions
 *
 * - **V1** (`HASH_VERSION_V1`) — the original basis. Includes `blueReversal`,
 *   `redReversal`, and `gridMode`. These three are RE-DERIVED on every
 *   `hydrate()` (reversal flags via `processReversals`; `gridMode` via
 *   `deriveStepGridMode`), so the hashed value can change between load and save
 *   even when nothing the user did changed — which mismatches the stored
 *   contentHash and silently FORKS the sequence on resave
 *   (`library-repository.ts` fork detection). See findings doc
 *   `docs/superpowers/specs/active/2026-06-30-reversal-derivation-reconciliation-findings.md`.
 * - **V2** (`HASH_VERSION_V2`) — excludes those round-trip-derived fields, so the
 *   identity is invariant under re-derivation (load→save can't fork). Proven
 *   collision-safe over the published corpus: every reversal *variant* already
 *   differs in flipped motion content (`reversal-seed-service.ts` flips pro↔anti
 *   + cw↔ccw), so dropping the redundant reversal flag merges nothing.
 *
 * `CONTENT_HASH_VERSION` is the ACTIVE version — **V2** since 2026-06-30, after
 * the corpus `contentHash` migration (`scripts/migrations/rehash-content-v2.ts`)
 * and version-aware fork detection shipped. The version-aware compare + lazy
 * rehash keep mixed-version data consistent, so the flip was race-free.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export const HASH_VERSION_V1 = 1;
export const HASH_VERSION_V2 = 2;

/**
 * ACTIVE identity-hash version — V2 as of 2026-06-30. Rollout complete:
 *   1. version-aware fork detection + lazy rehash deployed (compares
 *      same-version hashes; recomputes on version mismatch instead of forking),
 *   2. `scripts/migrations/rehash-content-v2.ts --apply` rewrote every stored
 *      `contentHash` to V2 (user library + public mirror; systemCatalogs empty),
 *   3. flipped to V2 here.
 * Any straggler still on V1 self-heals via the version-aware lazy rehash on next
 * access, so a rollback to V1 stays fork-safe too.
 */
export const CONTENT_HASH_VERSION = HASH_VERSION_V2;

interface ExtractOptions {
  /** V2: drop round-trip-derived fields (reversal flags, gridMode) so the hash
   *  is invariant under hydrate re-derivation. */
  readonly excludeDerived: boolean;
}

const V1_OPTS: ExtractOptions = { excludeDerived: false };
const V2_OPTS: ExtractOptions = { excludeDerived: true };

async function digest(content: unknown): Promise<string> {
  const json = JSON.stringify(content);
  const buffer = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Identity hash at the given version (defaults to the active version). V1 output
 * is byte-identical to the original implementation; V2 excludes the
 * round-trip-derived fields. Pass `HASH_VERSION_V2` explicitly to compute the
 * fork-proof identity (used by the rehash migration and its tests).
 */
export async function computeHash(
  sequence: SequenceData,
  version: number = CONTENT_HASH_VERSION
): Promise<string> {
  const opts = version >= HASH_VERSION_V2 ? V2_OPTS : V1_OPTS;
  return digest(extractContent(sequence, opts));
}

function extractContent(sequence: SequenceData, opts: ExtractOptions): unknown {
  // Resolve the sequence-level grid mode once. Steps and start positions
  // that don't specify their own gridMode inherit this value. Normalizing
  // here prevents undefined-vs-"diamond" from producing different hashes
  // for sequences that are physically identical.
  //
  // V2: gridMode is re-derived on hydrate, so it is dropped entirely from the
  // identity; physical sameness is already fully captured by the step
  // locations, which are stable.
  const seqGridMode = sequence.gridMode ?? null;

  return {
    ...(opts.excludeDerived ? {} : { gridMode: seqGridMode }),
    startPosition: extractStartPosition(
      sequence.startPosition ?? sequence.startingPosition,
      seqGridMode,
      opts
    ),
    steps: sequence.steps.map((step) => extractStep(step, seqGridMode, opts)),
  };
}

function extractStartPosition(
  sp: StartPositionData | undefined,
  inheritedGridMode: string | null,
  opts: ExtractOptions
): unknown {
  if (!sp) return null;
  return {
    motions: extractMotions(sp.motions, opts),
    ...(opts.excludeDerived
      ? {}
      : { gridMode: sp.gridMode ?? inheritedGridMode }),
  };
}

function extractStep(
  step: StepData,
  inheritedGridMode: string | null,
  opts: ExtractOptions
): unknown {
  // V2 drops blueReversal/redReversal (re-derived by processReversals on every
  // load) and gridMode (re-derived by deriveStepGridMode). letter is kept: it is
  // identity-bearing and is NOT re-derived on hydrate (deriveSteps reads the
  // persisted pairing letter).
  if (opts.excludeDerived) {
    return {
      letter: step.letter ?? null,
      isBlank: step.isBlank,
      duration: step.duration,
      motions: extractMotions(step.motions, opts),
    };
  }
  return {
    letter: step.letter ?? null,
    // V1's serialized property names are immutable. Existing Firestore hashes
    // were minted from blue/red labels even though the values now come from
    // performer-relative hand fields.
    blueReversal: step.leftReversal,
    redReversal: step.rightReversal,
    isBlank: step.isBlank,
    duration: step.duration,
    motions: extractMotions(step.motions, opts),
    gridMode: step.gridMode ?? inheritedGridMode,
  };
}

function extractMotions(
  motions: Partial<Record<HandSide, MotionData | undefined>>,
  opts: ExtractOptions
): unknown {
  // Hash labels and order are a persistence protocol. Keep the original blue
  // then red preimage while reading from canonical left/right channels.
  return Object.fromEntries(
    [
      ["blue", motions[HandSide.LEFT]],
      ["red", motions[HandSide.RIGHT]],
    ]
      .filter((entry): entry is [string, MotionData] => entry[1] !== undefined)
      .map(([legacyLabel, motion]) => [
        legacyLabel,
        extractMotion(motion, opts),
      ])
  );
}

// Intentionally excluded from hash:
// - arrowPlacementData, propPlacementData: rendering/layout concerns derived from motion fields
// - propType: viewer preference, not sequence identity (overridden by global settings)
// - isVisible, hand, arrowLocation: rendering state, not motion definition
function extractMotion(m: MotionData, opts: ExtractOptions): unknown {
  return {
    motionType: m.motionType,
    rotationDirection: m.rotationDirection,
    startLocation: m.startLocation,
    endLocation: m.endLocation,
    turns: m.turns,
    startOrientation: m.startOrientation,
    endOrientation: m.endOrientation,
    handPath: m.handPath ?? null,
    // V2: motion-level gridMode is re-derived on hydrate — drop it too.
    ...(opts.excludeDerived ? {} : { gridMode: m.gridMode }),
    skewSteps: m.skewSteps ?? null,
    skewDir: m.skewDir ?? null,
  };
}
