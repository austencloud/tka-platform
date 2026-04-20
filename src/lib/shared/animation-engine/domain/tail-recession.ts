/**
 * Velocity-matched tail recession for prop trails.
 *
 * While a prop is moving, every captured point extends the ring and records
 * an instantaneous speed (distance between the last two points, divided by
 * the time between them). That speed is carried in `speedPxPerMs` — an
 * exponentially smoothed memory of how fast the prop was traveling.
 *
 * When the prop stops, no new points arrive but the tail keeps "finishing"
 * the motion: each frame the visible endpoint walks forward along the ring
 * path by `speedPxPerMs × dtMs` pixels. Crossing from one ring segment into
 * the next shrinks `visibleCount` by one; whatever progress is left after
 * that crossing sets `prog`, the fractional position inside the current
 * segment. The tail retreats at the same spatial rate the prop was moving,
 * so stopping on a dime visually reads as "the trail catches up."
 *
 * `computeVisiblePath` then renders the last `visibleCount` ring entries,
 * sliding the first path point from `ring[start]` toward `ring[start + 1]`
 * by `prog` for sub-segment precision.
 */

export interface TailState {
  /** Fractional progress into the next segment, [0, 1). */
  prog: number;
  /** How many trailing ring entries are currently visible, [2, leadingEdge]. */
  visibleCount: number;
  /** EMA of prop speed in pixels per ms. Zero until the prop has moved. */
  speedPxPerMs: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/** Weight of the latest sample in the speed EMA. */
const SPEED_EMA_ALPHA = 0.35;

export function createTailState(leadingEdge: number): TailState {
  return { prog: 0, visibleCount: leadingEdge, speedPxPerMs: 0 };
}

/**
 * Update `state` for a single frame. Returns a NEW TailState (does not mutate).
 *
 * Moving frames: snap `prog` to 0, grow `visibleCount` back toward `leadingEdge`,
 * and update `speedPxPerMs` from the last appended ring segment.
 *
 * Stationary frames: advance the visible endpoint along the ring path by
 * `speedPxPerMs × dtMs` pixels, shrinking `visibleCount` for each full
 * segment crossed. Speed is NOT decayed during stationary time — the tail
 * keeps finishing the pre-stop motion at the pre-stop velocity.
 */
export function advanceTail(
  state: TailState,
  ring: readonly Point2D[],
  moved: boolean,
  dtMs: number,
  leadingEdge: number,
): TailState {
  if (moved) {
    const newSpeed = updateSpeedEma(state.speedPxPerMs, ring, dtMs);
    const grown = Math.min(leadingEdge, ring.length, state.visibleCount + 1);
    return {
      prog: 0,
      visibleCount: Math.max(2, grown),
      speedPxPerMs: newSpeed,
    };
  }

  // Stationary: walk the endpoint forward by speed × dt pixels.
  if (ring.length < 2 || state.speedPxPerMs <= 0 || dtMs <= 0) {
    return state;
  }

  let remaining = state.speedPxPerMs * dtMs;
  let visibleCount = Math.min(state.visibleCount, ring.length);
  let prog = state.prog;

  while (remaining > 0 && visibleCount > 2) {
    const start = ring.length - visibleCount;
    const a = ring[start]!;
    const b = ring[start + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);

    if (segLen <= 1e-6) {
      // Zero-length segment (duplicate point): consume it for free.
      visibleCount -= 1;
      prog = 0;
      continue;
    }

    const segRemainingPx = segLen * (1 - prog);
    if (remaining < segRemainingPx) {
      prog += remaining / segLen;
      remaining = 0;
    } else {
      remaining -= segRemainingPx;
      visibleCount -= 1;
      prog = 0;
    }
  }

  if (visibleCount <= 2) {
    prog = Math.min(prog, 0.9999);
  }

  return {
    prog,
    visibleCount,
    speedPxPerMs: state.speedPxPerMs,
  };
}

function updateSpeedEma(
  prevSpeed: number,
  ring: readonly Point2D[],
  dtMs: number,
): number {
  if (ring.length < 2 || dtMs <= 0) return prevSpeed;
  const last = ring[ring.length - 1]!;
  const prev = ring[ring.length - 2]!;
  const dist = Math.hypot(last.x - prev.x, last.y - prev.y);
  const instant = dist / dtMs;
  if (prevSpeed <= 0) return instant;
  return SPEED_EMA_ALPHA * instant + (1 - SPEED_EMA_ALPHA) * prevSpeed;
}

/**
 * Build the visible NDC path from the most recent `visibleCount` ring entries,
 * sliding the first point forward by `prog` within its segment.
 *
 * Returns an empty array when the ring hasn't collected enough points yet.
 */
export function computeVisiblePath(
  ring: readonly Point2D[],
  state: TailState,
  width: number,
  height: number,
  maxGapFraction: number = 0.3,
): Array<[number, number]> {
  if (ring.length < 2 || width <= 0 || height <= 0) return [];

  const visibleCount = Math.min(state.visibleCount, ring.length);
  if (visibleCount < 2) return [];

  const windowStart = ring.length - visibleCount;

  // Trim at any large spatial gap — teleports shouldn't connect by a line.
  let gapStart = windowStart;
  const maxGap = Math.max(width, height) * maxGapFraction;
  const maxGapSq = maxGap * maxGap;
  for (let i = ring.length - 1; i > gapStart; i--) {
    const curr = ring[i]!;
    const prev = ring[i - 1]!;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (dx * dx + dy * dy > maxGapSq) {
      gapStart = i;
      break;
    }
  }

  const toNdc = (x: number, y: number): [number, number] => [
    (x / width) * 2 - 1,
    1 - (y / height) * 2,
  ];

  const out: Array<[number, number]> = [];
  const t = Math.max(0, Math.min(0.9999, state.prog));

  if (t > 0 && gapStart + 1 < ring.length) {
    const a = ring[gapStart]!;
    const b = ring[gapStart + 1]!;
    out.push(toNdc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    for (let i = gapStart + 1; i < ring.length; i++) {
      const p = ring[i]!;
      out.push(toNdc(p.x, p.y));
    }
  } else {
    for (let i = gapStart; i < ring.length; i++) {
      const p = ring[i]!;
      out.push(toNdc(p.x, p.y));
    }
  }
  return out;
}
