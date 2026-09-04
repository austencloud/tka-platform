/**
 * Extra performers arrive from the center of the stack outward. Keeping the
 * final quarter of the transition as shared settle time makes every layer land
 * together instead of leaving the last copy visibly late.
 */
export function resolveTunnelLayerOpacity(
  progress: number,
  layerIndex: number,
  layerCount: number
): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (layerCount <= 1) return clampedProgress;

  const staggerWindow = 0.24;
  const start =
    (Math.max(0, Math.min(layerCount - 1, layerIndex)) / (layerCount - 1)) *
    staggerWindow;
  return Math.max(0, Math.min(1, (clampedProgress - start) / (1 - start)));
}

/**
 * The ordinary 2D grid leaves on the same progress that introduces Tunnel.
 * A Tunnel whose own grid is enabled keeps it throughout the transformation.
 */
export function resolveTunnelGridOpacity(
  progress: number,
  tunnelGridVisible: boolean
): number {
  if (tunnelGridVisible) return 1;
  return 1 - Math.max(0, Math.min(1, progress));
}
