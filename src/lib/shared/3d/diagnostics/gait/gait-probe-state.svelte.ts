/**
 * Gait probe state
 *
 * The channel between the probe, which lives inside the Threlte canvas, and
 * the readout, which lives in the DOM beside it. One module-level store rather
 * than a context, because the instrument has to be mountable from either side
 * of the canvas boundary without any host being asked to plumb a prop through
 * for it.
 *
 * Off by default and off in production builds unless explicitly asked for: an
 * instrument that runs when nobody is reading it is a per-frame scene
 * traversal charged to every user.
 */

import type { GaitReport } from "./gait-analysis";
import type { Vec3 } from "./gait-frame";

const TRAIL_LIMIT = 600;

let enabled = $state(false);
let reports = $state<Map<string, GaitReport>>(new Map());
const trails = $state<Map<string, Vec3[]>>(new Map());

/**
 * Whether the instrument should run.
 *
 * Read from the URL so a surface can be handed over already measuring —
 * `?gait=1` on any 3D route — and from a window flag so it can be switched on
 * mid-session from the console without a reload.
 */
export function resolveGaitProbeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const flagged = (window as unknown as { __gaitProbeEnabled?: boolean })
    .__gaitProbeEnabled;
  if (typeof flagged === "boolean") return flagged;
  try {
    return new URL(window.location.href).searchParams.get("gait") === "1";
  } catch {
    return false;
  }
}

export const gaitProbeState = {
  get enabled(): boolean {
    return enabled;
  },
  get reports(): Map<string, GaitReport> {
    return reports;
  },

  trail(id: string): readonly Vec3[] {
    return trails.get(id) ?? [];
  },

  enable(): void {
    enabled = true;
    if (typeof window !== "undefined") {
      (window as unknown as { __gaitProbeEnabled?: boolean }).__gaitProbeEnabled =
        true;
    }
  },

  disable(): void {
    enabled = false;
    reports = new Map();
    trails.clear();
    if (typeof window !== "undefined") {
      (window as unknown as { __gaitProbeEnabled?: boolean }).__gaitProbeEnabled =
        false;
    }
  },

  /** Sync from the URL / window flag once, at scene mount. */
  syncFromEnvironment(): void {
    enabled = resolveGaitProbeEnabled();
  },

  publish(next: Map<string, GaitReport>): void {
    // A new Map, not a mutation: the readout re-renders off identity, and
    // mutating in place would leave it showing the first report forever.
    reports = new Map(next);
  },

  /** Record where a rig has been, for the floor trace behind the footfalls. */
  pushTrail(id: string, point: Vec3): void {
    let trail = trails.get(id);
    if (!trail) {
      trail = [];
      trails.set(id, trail);
    }
    const last = trail[trail.length - 1];
    // Only when it has actually gone somewhere, so standing still does not
    // fill the buffer with the same point and squeeze out the walk.
    if (last && Math.hypot(point.x - last.x, point.z - last.z) < 0.02) return;
    trail.push({ ...point });
    if (trail.length > TRAIL_LIMIT) trail.splice(0, trail.length - TRAIL_LIMIT);
  },
};
