/**
 * Typography Scaler — responsive font size calculations with smooth easing.
 */

export function calculateResponsiveFontSize(
  minSize: number,
  maxSize: number,
  vwMultiplier: number
): string {
  const viewportWidth = getViewportWidth();
  const vwValue = (viewportWidth / 100) * vwMultiplier;
  const clampedValue = Math.max(minSize, Math.min(vwValue, maxSize));

  const range = maxSize - minSize;
  const easedValue =
    minSize +
    (clampedValue - minSize) *
      Math.pow((clampedValue - minSize) / range, 0.85);

  return `${easedValue.toFixed(1)}px`;
}

export function getViewportWidth(): number {
  return window.innerWidth;
}

/**
 * Drop-in replacement for the old singleton.
 */
export const typographyScaler = {
  calculateResponsiveFontSize,
  getViewportWidth,
};
