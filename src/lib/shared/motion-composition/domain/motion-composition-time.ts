import type { TimeMapping } from "./motion-composition-types";

export function positiveModulo(value: number, modulus: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(modulus) || modulus <= 0) {
    return 0;
  }
  return ((value % modulus) + modulus) % modulus;
}

export function mapCompositionBeat(
  compositionBeat: number,
  trackDurationBeats: number,
  mapping: TimeMapping
): number {
  if (
    !Number.isFinite(compositionBeat) ||
    !Number.isFinite(trackDurationBeats) ||
    trackDurationBeats <= 0 ||
    !Number.isFinite(mapping.offsetBeats)
  ) {
    return 0;
  }

  const rate = Number.isFinite(mapping.rate) ? Math.max(0, mapping.rate) : 0;
  const elapsed = (compositionBeat - mapping.offsetBeats) * rate;
  if (elapsed <= 0) return 0;

  if (mapping.completion === "loop") {
    return positiveModulo(elapsed, trackDurationBeats);
  }

  if (mapping.completion === "stretch") {
    const span = mapping.stretchToBeats ?? trackDurationBeats;
    if (!Number.isFinite(span) || span <= 0) return 0;
    return Math.min(1, elapsed / span) * trackDurationBeats;
  }

  return Math.min(elapsed, trackDurationBeats);
}
