/**
 * LOOP display resolver
 *
 * Shared entry point for any UI that wants to show LOOP icons for a sequence.
 * Returns the active components and — for rotated loops — whether the rotation
 * is halved (180°) or quartered (90°), so the icon strip can pick the right
 * visual ("fa-rotate" vs "fa-arrows-spin").
 *
 * Why this lives here rather than in the consumer:
 * Every card, export header, and animator canvas had its own copy of the
 * "stored loopType → components, else detect on-demand" branching. That meant
 * any change to detection (like slice-aware icons) had to be repeated in six
 * places. This resolver is the single source of truth.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceEntry } from "../domain/models/sequence-models";
import type { ComponentId } from "../domain/constants/loop-components";
import {
  LOOPComponent,
  RESERVED_ORIENTATION_PRIMITIVES,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import {
  SliceSize,
  type LOOPType,
} from "$lib/features/create/generate/circular/domain/models/circular-models";
import { loopDetector } from "./implementations/LOOPDetector";
import { sequenceToEntryConverter } from "$lib/features/choreo-card/services/implementations/SequenceToEntryConverter";
import { loopTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";

export interface LoopDisplay {
  components: Set<LOOPComponent>;
  rotationSliceSize?: SliceSize;
}

/**
 * Input accepted by resolveLoopDisplay — either a full library SequenceData
 * (with typed .steps) or a thin SequenceEntry (with .fullMetadata.sequence).
 * The resolver figures out which path it got and adapts accordingly.
 */
export type LoopDisplayInput = SequenceData | SequenceEntry;

/**
 * Mapping from ComponentId strings (the loop-labeler's internal identifier)
 * to the LOOPComponent enum that every UI consumer actually uses.
 * The 6 primitives share the same lowercase string value across both systems,
 * so this is essentially an identity cast — but we do it explicitly so adding
 * a new ComponentId (like "repeated" or "modular") can't silently leak into
 * UI that expects only the 6 classic primitives.
 */
function toLoopComponent(id: ComponentId): LOOPComponent | null {
  switch (id) {
    case "rotated":
      return LOOPComponent.ROTATED;
    case "mirrored":
      return LOOPComponent.MIRRORED;
    case "flipped":
      return LOOPComponent.FLIPPED;
    case "swapped":
      return LOOPComponent.SWAPPED;
    case "inverted":
      return LOOPComponent.INVERTED;
    case "rewound":
      return LOOPComponent.REWOUND;
    default:
      return null;
  }
}

function mapRotationInterval(
  interval: string | undefined
): SliceSize | undefined {
  if (interval === "halved") return SliceSize.HALVED;
  if (interval === "quartered") return SliceSize.QUARTERED;
  return undefined;
}

function isSequenceData(input: LoopDisplayInput): input is SequenceData {
  // SequenceData has a typed readonly steps array; SequenceEntry doesn't.
  // The .steps check is safe because SequenceEntry has no .steps property at all.
  return Array.isArray((input as SequenceData).steps);
}

function getSequenceId(input: LoopDisplayInput): string | undefined {
  return input.id;
}

function hasEnoughSteps(input: LoopDisplayInput): boolean {
  if (isSequenceData(input)) {
    return (input.steps?.length ?? 0) >= 2;
  }
  // SequenceEntry: steps live under fullMetadata.sequence, filtered to beat >= 1
  const raw = input.fullMetadata?.sequence ?? [];
  const actualSteps = raw.filter(
    (el) => typeof el.beat === "number" && el.beat >= 1
  );
  return actualSteps.length >= 2;
}

function toSequenceEntry(input: LoopDisplayInput): SequenceEntry {
  if (isSequenceData(input)) {
    return sequenceToEntryConverter.convert(input);
  }
  return input;
}

// ============================================================================
// CACHE
// ============================================================================

/**
 * In-memory cache keyed by sequence id. Detection runs beam search over
 * every beat pair — about 1–3ms on a 16-beat sequence, but the library
 * grid renders hundreds of these at once, so even 1ms per card stacks up.
 * The cache lets us pay once per sequence per session.
 *
 * Sequences that lack an id (rare — mostly ephemeral in-editor drafts)
 * bypass the cache and run detection fresh each call. That's intentional:
 * caching those by object identity would leak memory as the editor mutates
 * the draft in place.
 */
const displayCache = new Map<string, LoopDisplay>();

/**
 * For tests. Call this in beforeEach to get a clean cache.
 */
export function clearLoopDisplayCache(): void {
  displayCache.clear();
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Resolve the active LOOP components and — when rotated — the rotation slice
 * size (halved or quartered) for a sequence.
 *
 * Resolution order:
 * 1. If the sequence has real steps (length ≥ 2), run the loop-labeler's
 *    detector. This gives us transformationIntervals, which is the only way
 *    to tell a 90° rotation from a 180° rotation.
 * 2. Else, if the sequence has a stored loopType string, parse that into
 *    components. We can't recover slice size from a string, so
 *    rotationSliceSize stays undefined.
 * 3. Else, return an empty set.
 *
 * The on-demand path takes precedence because a stored loopType can be stale
 * after an edit, but computing from current steps is always accurate.
 */
export function resolveLoopDisplay(input: LoopDisplayInput): LoopDisplay {
  const cacheKey = getSequenceId(input);
  if (cacheKey) {
    const cached = displayCache.get(cacheKey);
    if (cached) return cached;
  }

  const result = computeLoopDisplay(input);

  if (cacheKey) {
    displayCache.set(cacheKey, result);
  }
  return result;
}

function computeLoopDisplay(input: LoopDisplayInput): LoopDisplay {
  // Path 1: real steps → run detection
  if (hasEnoughSteps(input)) {
    try {
      const entry = toSequenceEntry(input);
      const detection = loopDetector.detectLOOP(entry);

      const components = new Set<LOOPComponent>();
      for (const id of detection.components) {
        const mapped = toLoopComponent(id);
        if (mapped && !RESERVED_ORIENTATION_PRIMITIVES.has(mapped)) {
          components.add(mapped);
        }
      }

      if (components.size > 0) {
        return {
          components,
          rotationSliceSize: mapRotationInterval(
            detection.transformationIntervals?.rotation
          ),
        };
      }
      // Detection returned nothing usable — fall through to stored loopType
    } catch {
      // Detection blew up (malformed motions, missing positions, etc.)
      // Fall through to stored loopType rather than returning empty.
    }
  }

  // Path 2: stored loopType string.
  // SequenceEntry types this as `string | null`, SequenceData as `LOOPType`.
  // parseComponents handles any string value that matches the 6 primitive
  // names, so cast to the stricter type — parseComponents does its own
  // substring matching and is safe for unknown strings.
  const storedLoopType = input.loopType as LOOPType | null | undefined;
  if (storedLoopType) {
    const parsed = loopTypeResolver.parseComponents(storedLoopType);
    const components = new Set<LOOPComponent>();
    for (const c of parsed) {
      if (!RESERVED_ORIENTATION_PRIMITIVES.has(c)) components.add(c);
    }
    if (components.size > 0) {
      return { components, rotationSliceSize: undefined };
    }
  }

  // Path 3: nothing to show
  return { components: new Set<LOOPComponent>(), rotationSliceSize: undefined };
}
