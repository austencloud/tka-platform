import { DURATION } from "$lib/shared/transitions/transitions";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import {
  lerp,
  lerpAngle,
} from "$lib/shared/animation-engine/services/angle-calculator";

/** One structural phrase: separate, establish the formation, and settle. */
export const TUNNEL_REVEAL_DURATION = DURATION.emphasis + DURATION.normal;

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}

/**
 * Per-copy progress through the formation change.
 *
 * This is shared by geometry and opacity so a rapid reversal retraces one
 * coherent path instead of asking two independent clocks to catch each other.
 */
export function resolveTunnelLayerProgress(
  progress: number,
  layerIndex: number,
  layerCount: number
): number {
  const clampedProgress = clampProgress(progress);
  if (layerCount <= 1) return clampedProgress;

  const staggerWindow = 0.62;
  const start =
    (Math.max(0, Math.min(layerCount - 1, layerIndex)) / (layerCount - 1)) *
    staggerWindow;
  const localProgress = clampProgress((clampedProgress - start) / (1 - start));
  return localProgress * localProgress * (3 - 2 * localProgress);
}

function propPosition(state: PropState): { x: number; y: number } {
  if (state.x !== undefined && state.y !== undefined) {
    return { x: state.x, y: state.y };
  }
  return {
    x: Math.cos(state.centerPathAngle),
    y: Math.sin(state.centerPathAngle),
  };
}

/** Distance the copy has visibly peeled away, in grid-radius units. */
export function tunnelLayerPositionSeparation(
  base: PropState | null,
  current: PropState | null
): number {
  if (base === null || current === null) return 0;
  const from = propPosition(base);
  const to = propPosition(current);
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/**
 * Peel one Tunnel prop out of the live 2D prop into its authored copy pose.
 *
 * At zero the duplicate sits exactly under the base prop and is transparent.
 * It then becomes legible while separating into the formation. Both angles use
 * the renderer's canonical shortest-path interpolation; dash coordinates follow
 * the same progress when both endpoints carry them.
 */
export function interpolateTunnelLayerProp(
  base: PropState | null,
  target: PropState | null,
  progress: number
): PropState | null {
  if (target === null) return null;
  if (base === null) return target;

  const clampedProgress = clampProgress(progress);
  if (clampedProgress === 0) return base;
  if (clampedProgress === 1) return target;

  // Position travels in canvas space rather than by angular shortest-path.
  // A moving pair can straddle the 180° seam from one frame to the next; an
  // angular branch would then flip sides, while this line remains continuous.
  const from = propPosition(base);
  const to = propPosition(target);
  const x = lerp(from.x, to.x, clampedProgress);
  const y = lerp(from.y, to.y, clampedProgress);
  return {
    centerPathAngle: Math.atan2(y, x),
    staffRotationAngle: lerpAngle(
      base.staffRotationAngle,
      target.staffRotationAngle,
      clampedProgress
    ),
    x,
    y,
  };
}

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
  return resolveTunnelLayerProgress(progress, layerIndex, layerCount);
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
