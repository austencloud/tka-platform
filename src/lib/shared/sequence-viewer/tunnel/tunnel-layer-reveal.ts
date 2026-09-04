import { DURATION } from "$lib/shared/transitions/transitions";

/** Long enough for the formation to arrive in distinct overlapping waves. */
export const TUNNEL_REVEAL_DURATION = DURATION.dramatic;

/**
 * Extra performers arrive from the center of the stack outward. Keeping the
 * final third of the transition as overlapping settle time keeps the result
 * composed while giving each arrival enough separation to read as a wave.
 */
export function resolveTunnelLayerOpacity(
  progress: number,
  layerIndex: number,
  layerCount: number
): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (layerCount <= 1) return clampedProgress;

  const staggerWindow = 0.62;
  const start =
    (Math.max(0, Math.min(layerCount - 1, layerIndex)) / (layerCount - 1)) *
    staggerWindow;
  const localProgress = Math.max(
    0,
    Math.min(1, (clampedProgress - start) / (1 - start))
  );
  // Soft shoulders keep each copy from blinking on at its start or braking at
  // the endpoint. Reversing the master progress retraces this exact curve.
  return localProgress * localProgress * (3 - 2 * localProgress);
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
  // Clear the construction grid during the opening third, before the outer
  // performers become dominant. This turns the handoff into two overlapping
  // phrases instead of fading every visual ingredient at once.
  const localProgress = Math.max(0, Math.min(1, progress / 0.38));
  const easedProgress = localProgress * localProgress * (3 - 2 * localProgress);
  return 1 - easedProgress;
}
