/**
 * Pure BPM → timestamp helpers for the annotated sheet's cue rail. A band's
 * timestamp is prefilled from its first step's beat index (1 step = 1 beat) at
 * the act's BPM; the user can overtype any value, so prefill only fills blanks.
 */

/** Beat index → "M:SS" at `bpm` beats/minute. */
export function beatIndexToTimestamp(beatIndex: number, bpm: number): string {
  const seconds = (beatIndex / bpm) * 60;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface PrefillBand {
  key: string;
  firstBeatIndex: number;
  timestamp: string; // current value; blank ("") means prefillable
}

/**
 * Returns a map of bandKey → new timestamp for ONLY the blank bands. Bands with
 * existing text are omitted (caller keeps their current value). Empty map when
 * bpm is missing/non-positive.
 */
export function prefillTimestamps(bands: readonly PrefillBand[], bpm: number | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!bpm || bpm <= 0) return out;
  for (const band of bands) {
    if (band.timestamp.trim() !== "") continue;
    out[band.key] = beatIndexToTimestamp(band.firstBeatIndex, bpm);
  }
  return out;
}
