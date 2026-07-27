/**
 * Legacy annotation migration: band-relative → absolute step index.
 *
 * Cues and notes used to address a `band` ("sequenceId:rowInSequence") plus, for
 * notes, a `count` (1-based column within that row). Both halves are functions
 * of `layout.columns`: at 8 columns band `x:1` holds steps 8..15, at 4 columns
 * it holds steps 4..7. Changing the pictograph size therefore re-pointed every
 * annotation — notes past the new row width were silently demoted to bullets,
 * and BPM-prefilled cue timestamps stayed on rows that now start elsewhere.
 *
 * The conversion is exact and self-contained, because the saved document
 * carries the very layout its annotations were written against:
 *
 *   stepIndex = rowInSequence * savedColumns + (count - 1)
 *
 * A legacy bullet (`count: null`) had no column, so it anchors to its row's
 * first step — the closest true statement about where the user put it.
 */
import type { CueMark, NoteMark } from "./types/choreo-sheet";

export interface LegacyCueMark {
  band: string;
  timestamp?: unknown;
  text?: unknown;
}

export interface LegacyNoteMark {
  id: string;
  band: string;
  count?: unknown;
  text?: unknown;
}

/**
 * Split a legacy band key into its parts.
 *
 * Sequence ids are opaque and may themselves contain ":", so the row is taken
 * from the LAST separator. Returns null for a key that isn't `<id>:<integer>`,
 * so a malformed annotation is dropped rather than silently anchored to step 0.
 */
export function parseLegacyBandKey(
  band: string
): { sequenceId: string; rowInSequence: number } | null {
  const sep = band.lastIndexOf(":");
  if (sep <= 0 || sep === band.length - 1) return null;

  const sequenceId = band.slice(0, sep);
  const rowText = band.slice(sep + 1);
  if (!/^\d+$/.test(rowText)) return null;

  return { sequenceId, rowInSequence: Number(rowText) };
}

const asText = (v: unknown): string => (typeof v === "string" ? v : "");

/** Legacy shapes still carry a `band`; migrated ones carry a `stepIndex`. */
export function isLegacyCue(cue: unknown): cue is LegacyCueMark {
  return !!cue && typeof cue === "object" && "band" in cue && !("stepIndex" in cue);
}
export function isLegacyNote(note: unknown): note is LegacyNoteMark {
  return !!note && typeof note === "object" && "band" in note && !("stepIndex" in note);
}

/**
 * A legacy cue anchored a whole row, so it lands on that row's first step.
 * Returns null when the band key is unparseable.
 */
export function migrateCue(legacy: LegacyCueMark, savedColumns: number): CueMark | null {
  const parsed = parseLegacyBandKey(legacy.band);
  if (!parsed) return null;

  return {
    sequenceId: parsed.sequenceId,
    stepIndex: parsed.rowInSequence * savedColumns,
    timestamp: asText(legacy.timestamp),
    text: asText(legacy.text),
  };
}

/**
 * A legacy note with a `count` addressed one column of its row; without one it
 * was a full-width bullet and anchors to the row's first step.
 *
 * An out-of-range count (the already-demoted case: a note whose column ran past
 * a short last row) keeps its arithmetic position and migrates as a bullet,
 * matching what the user actually saw. Returns null for an unparseable band.
 */
export function migrateNote(legacy: LegacyNoteMark, savedColumns: number): NoteMark | null {
  const parsed = parseLegacyBandKey(legacy.band);
  if (!parsed) return null;

  const rawCount = typeof legacy.count === "number" ? legacy.count : null;
  const pinned = rawCount != null && rawCount >= 1 && rawCount <= savedColumns;
  const column = pinned ? rawCount - 1 : 0;

  return {
    id: legacy.id,
    sequenceId: parsed.sequenceId,
    stepIndex: parsed.rowInSequence * savedColumns + column,
    pinned,
    text: asText(legacy.text),
  };
}

/**
 * Migrate a mixed annotation list. Already-migrated entries pass through
 * untouched, so this is safe to run on every load.
 */
export function migrateCues(raw: readonly unknown[], savedColumns: number): CueMark[] {
  const out: CueMark[] = [];
  for (const entry of raw) {
    if (isLegacyCue(entry)) {
      const migrated = migrateCue(entry, savedColumns);
      if (migrated) out.push(migrated);
    } else if (entry) {
      out.push(entry as CueMark);
    }
  }
  return out;
}

export function migrateNotes(raw: readonly unknown[], savedColumns: number): NoteMark[] {
  const out: NoteMark[] = [];
  for (const entry of raw) {
    if (isLegacyNote(entry)) {
      const migrated = migrateNote(entry, savedColumns);
      if (migrated) out.push(migrated);
    } else if (entry) {
      out.push(entry as NoteMark);
    }
  }
  return out;
}
