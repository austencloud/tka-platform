export const FIRE_PROP_VISIBILITY = {
  densityStart: 0.62,
  densityFull: 0.94,
  emissionWeight: 0.7,
  softAlphaCap: 0.56,
  denseAlphaCap: 0.46,
  denseCapStart: 0.75,
  tipFreedom: 0.72,
  heatColorRetention: 0.52,
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Scale applied to premultiplied fire color and alpha where fire crosses a
 * visible prop. Calm flame is untouched. Dense flame retains enough foreground
 * coverage to feel wrapped around the prop without replacing its silhouette.
 */
export function computeFirePropVisibilityScale(
  alpha: number,
  peakEmission: number,
  propMatte: number,
  tipFreedom: number
): number {
  const densitySignal = Math.max(
    clamp01(alpha),
    clamp01(peakEmission * FIRE_PROP_VISIBILITY.emissionWeight)
  );
  const severity = smoothstep(
    FIRE_PROP_VISIBILITY.densityStart,
    FIRE_PROP_VISIBILITY.densityFull,
    densitySignal
  );
  const denseCapMix = smoothstep(
    FIRE_PROP_VISIBILITY.denseCapStart,
    1,
    severity
  );
  const alphaCap =
    FIRE_PROP_VISIBILITY.softAlphaCap +
    (FIRE_PROP_VISIBILITY.denseAlphaCap - FIRE_PROP_VISIBILITY.softAlphaCap) *
      denseCapMix;
  const safeAlpha = Math.max(alpha, 0.00001);
  const capScale = alpha > alphaCap ? alphaCap / safeAlpha : 1;
  const tipExemption =
    1 - clamp01(tipFreedom) * FIRE_PROP_VISIBILITY.tipFreedom;
  const protection = clamp01(propMatte) * severity * tipExemption;
  return 1 + (capScale - 1) * protection;
}
