function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Shared Persistence mapping for the 2D and 3D Ghost renderers. */
export function resolveGhostLifetimeSeconds(decay: number): number {
  return 0.2 + Math.max(0, Math.min(10, decay)) * 0.18;
}

/** Shared angular pose quantization. Higher Density always means finer sampling. */
export function resolveGhostAngleQuantization(density: number): number {
  return Math.max(0.04, 0.3 * (1 - 0.85 * clamp01(density)));
}

/**
 * Retain enough lightweight pose snapshots for visible slots to span the same
 * motion arc at every Density. Finer buckets create more distinct poses, so
 * the hidden capture buffer grows inversely with the angular bucket size while
 * the number of mounted `Prop3D` slots stays fixed.
 */
export function resolveGhostHistoryCapacity(
  density: number,
  visibleSlots: number
): number {
  const slots = Math.max(0, Math.floor(visibleSlots));
  if (slots === 0) return 0;

  const widestAngleBucket = resolveGhostAngleQuantization(0);
  const activeAngleBucket = resolveGhostAngleQuantization(density);
  // 3.3 windows retain a complete two-second exposure even when a 120 Hz
  // renderer crosses into a distinct high-Density bucket every frame.
  const coverageMultiplier = 3.3 * (widestAngleBucket / activeAngleBucket);
  return Math.min(
    256,
    Math.max(slots + 1, Math.ceil((slots + 1) * coverageMultiplier))
  );
}

/**
 * Shared position quantization. `referenceSpan` is canvas width in 2D and prop
 * length in 3D; `minimum` prevents microscopic buckets at high density.
 */
export function resolveGhostPositionQuantization(
  density: number,
  referenceSpan: number,
  minimum: number
): number {
  return Math.max(
    minimum,
    referenceSpan * 0.05 * (1 - 0.85 * clamp01(density))
  );
}
