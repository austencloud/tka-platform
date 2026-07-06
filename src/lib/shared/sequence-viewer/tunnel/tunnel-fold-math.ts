/**
 * Convert AnimationPlayer's 1-indexed fractional currentStep (where <1 is the
 * start position) to a 0-indexed step index + fractional progress within it.
 *
 * (The old fold/mirror config types lived here; they were replaced by the
 * explicit look catalog in `tunnel-looks.ts`. Only this step math survives.)
 */
export function stepToIndexProgress(
  currentStep: number,
  length: number,
): { idx: number; progress: number } {
  if (length <= 0) return { idx: 0, progress: 0 };
  const beat = Math.max(0, currentStep - 1); // 0-indexed
  const idx = Math.min(length - 1, Math.max(0, Math.floor(beat)));
  const progress = Math.max(0, Math.min(0.9999, beat - Math.floor(beat)));
  return { idx, progress };
}
