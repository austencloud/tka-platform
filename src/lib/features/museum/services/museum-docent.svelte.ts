/**
 * The docent — the museum walking itself around.
 *
 * Austen (2026-08-05): *"he just entered the museum and now he has no idea what
 * to do he's in a 3D environment he says I haven't looked at museum yet and when
 * he gets in there he has no idea that he can walk around so maybe a whole thing
 * should be the integration of an automated capability to walk and look around
 * within the museum module itself."*
 *
 * Note where this lives: **in the museum**, not in the presenter. The attract
 * ghost is a DOM-only observer by design — it presses annotated buttons and
 * knows nothing about any feature's internals (see
 * `docs/superpowers/specs/2026-08-04-ghost-mind-design.md` §Sensors). Teaching
 * it to steer a 3D character would break that and put museum pathfinding in a
 * file that must never import feature code. So the museum owns its own
 * autopilot, the ghost presses one annotated button, and the capability is
 * useful outside presentation mode too.
 *
 * It drives the SAME `heldKeys` set the keyboard fills, so movement, collision,
 * portals and void-recovery all run through `MuseumPlayerController` exactly as
 * they do for a human. Nothing here moves the player directly.
 */

import { tileKey, type MuseumGrid } from "../domain/museum-grid-types";
import { isWalkable as isTypeWalkable } from "../domain/tile-registry";

/** Distinguishes a remount (new instance) from a stop() call, which look the
 * same from outside and have opposite fixes. */
let instances = 0;

/** How close (in tiles) counts as arrived. */
const ARRIVE_EPSILON = 0.6;
/** No progress for this long means the path is blocked by something unmodelled. */
const STUCK_MS = 2600;
/** Stand and look at an exhibit for this long before moving on. */
const ADMIRE_MS = 5200;

export interface DocentTarget {
  x: number;
  y: number;
  /** Set when the destination is a plaque worth stopping in front of. */
  label?: string;
}

function isWalkable(grid: MuseumGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  const tile = grid.tiles.get(tileKey(x, y));
  if (!tile) return false;
  return isTypeWalkable(tile.type);
}

/**
 * Breadth-first over walkable tiles. BFS rather than A*: museum floors are a few
 * thousand tiles at most, it runs once per destination, and it cannot be fooled
 * by a heuristic into hugging a wall it can't pass.
 */
function findPath(
  grid: MuseumGrid,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const goal = { x: Math.round(to.x), y: Math.round(to.y) };
  if (start.x === goal.x && start.y === goal.y) return [];

  const cameFrom = new Map<string, string | null>([[tileKey(start.x, start.y), null]]);
  const queue: { x: number; y: number }[] = [start];
  const NEIGHBOURS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  let found = false;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === goal.x && cur.y === goal.y) {
      found = true;
      break;
    }
    for (const d of NEIGHBOURS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const key = tileKey(nx, ny);
      if (cameFrom.has(key)) continue;
      // The goal itself may be a solid exhibit tile — a plaque is a thing you
      // walk UP TO, not onto. Allow it as a terminal square only.
      const walkable = isWalkable(grid, nx, ny);
      if (!walkable && !(nx === goal.x && ny === goal.y)) continue;
      cameFrom.set(key, tileKey(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!found) return [];

  const path: { x: number; y: number }[] = [];
  let cursor: string | null = tileKey(goal.x, goal.y);
  while (cursor) {
    const [cx, cy] = cursor.split(",").map(Number);
    path.push({ x: cx!, y: cy! });
    cursor = cameFrom.get(cursor) ?? null;
  }
  path.reverse();
  // Drop the tile we are standing on, and the goal itself when it is solid —
  // walking into a wall to admire it is not the intent.
  path.shift();
  if (path.length && !isWalkable(grid, goal.x, goal.y)) path.pop();
  return path;
}

export interface MuseumDocent {
  readonly active: boolean;
  /** What it is doing right now, for the presenter's caption and the HUD. */
  readonly status: string;
  start: () => void;
  stop: (reason?: string) => void;
  /**
   * Called every frame by the scene host. Writes into the SAME heldKeys set the
   * keyboard fills, so the player controller cannot tell the difference.
   */
  step: (
    heldKeys: Set<string>,
    player: { x: number; y: number },
    nowMs: number,
  ) => void;
  /** Why it is doing what it is doing. Read via window.__docent in dev. */
  debug: () => Record<string, unknown>;
}

export function createMuseumDocent(opts: {
  getGrid: () => MuseumGrid | null;
  /** Seeded when the presenter drives it, so a replayed tour walks the same route. */
  random?: () => number;
}): MuseumDocent {
  const random = opts.random ?? Math.random;
  const instanceId = ++instances;
  let stopReason: string | null = null;

  /*
   * The tour survives a remount. Walking through a portal into another wing
   * re-creates the scene host, which was silently ending the tour after about
   * forty seconds — measured live: it crossed from the Vulcan Cave into the
   * Renaissance Wing and simply stopped, button back to "Look around". Same
   * latch the presenter uses for its own arming, and it makes an HMR update
   * during development non-destructive too.
   */
  const LATCH = "tka-museum-docent";
  const latched = (() => {
    try {
      return sessionStorage.getItem(LATCH) === "1";
    } catch {
      return false;
    }
  })();
  function latch(on: boolean): void {
    try {
      if (on) sessionStorage.setItem(LATCH, "1");
      else sessionStorage.removeItem(LATCH);
    } catch {
      /* private-mode storage is not worth a broken tour */
    }
  }

  const state = $state({
    active: latched,
    status: latched ? "Having a look around" : "",
  });

  let path: { x: number; y: number }[] = [];
  let target: DocentTarget | null = null;
  let admireUntil = 0;
  let lastProgressAt = 0;
  let lastDistance = Infinity;
  const seen = new Set<string>();

  function release(heldKeys: Set<string>): void {
    for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) heldKeys.delete(key);
  }

  /**
   * Somewhere worth going: an unvisited plaque first, because a museum is its
   * exhibits. Falls back to a random reachable floor tile so an exhibit-less
   * room (or one where every plaque has been seen) still gets wandered rather
   * than stood in.
   */
  function chooseTarget(grid: MuseumGrid, from: { x: number; y: number }): DocentTarget | null {
    const unseen = grid.exhibits.filter((e) => !seen.has(e.id));
    const pool = unseen.length ? unseen : grid.exhibits;
    if (pool.length) {
      /*
       * NEAREST few, not any at random. Measured live: random choice picked
       * plaques 76 and 166 tiles away, so at walking pace it never actually
       * reached one — a tour that is permanently in transit shows a passerby
       * corridors. Pick among the closest handful so it arrives, stops, and
       * reads something, while staying unpredictable.
       */
      const nearest = [...pool]
        .sort(
          (a, b) =>
            Math.hypot(a.tileX - from.x, a.tileY - from.y) -
            Math.hypot(b.tileX - from.x, b.tileY - from.y),
        )
        .slice(0, 4);
      const pick = nearest[Math.floor(random() * nearest.length)]!;
      seen.add(pick.id);
      return {
        x: pick.tileX,
        y: pick.tileY,
        label: pick.plaque?.title,
      };
    }

    // No exhibits: pick a walkable tile a real distance away, so the walk reads
    // as going somewhere rather than shuffling.
    const candidates: { x: number; y: number }[] = [];
    for (const [key, tile] of grid.tiles) {
      if (!isTypeWalkable(tile.type)) continue;
      const [x, y] = key.split(",").map(Number);
      if (x === undefined || y === undefined) continue;
      if (Math.hypot(x - from.x, y - from.y) < 6) continue;
      candidates.push({ x, y });
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(random() * candidates.length)]!;
  }

  function retarget(player: { x: number; y: number }, nowMs: number): void {
    const grid = opts.getGrid();
    if (!grid) return;
    target = chooseTarget(grid, player);
    path = target ? findPath(grid, player, target) : [];
    lastProgressAt = nowMs;
    lastDistance = Infinity;
    state.status = target?.label
      ? `Walking over to ${target.label}`
      : "Having a look around";
  }

  return {
    get active() {
      return state.active;
    },
    get status() {
      return state.status;
    },

    start() {
      latch(true);
      state.active = true;
      state.status = "Having a look around";
      path = [];
      target = null;
      admireUntil = 0;
    },

    stop(reason = "explicit") {
      stopReason = reason;
      latch(false);
      state.active = false;
      state.status = "";
      path = [];
      target = null;
    },

    debug() {
      return {
        target,
        pathAhead: path.slice(0, 4),
        pathLength: path.length,
        lastDistance,
        instanceId,
        stopReason,
        latched,
      };
    },

    step(heldKeys, player, nowMs) {
      if (!state.active) return;

      if (nowMs < admireUntil) {
        release(heldKeys);
        return;
      }

      if (!path.length) {
        retarget(player, nowMs);
        if (!path.length) {
          // Nowhere to go at all (a one-room box, or the grid has not streamed
          // in yet). Stand still rather than mash keys into a wall.
          release(heldKeys);
          admireUntil = nowMs + 1500;
          return;
        }
      }

      const next = path[0]!;
      /*
       * Steering is GRID-NATIVE, on rounded tiles, not on the continuous
       * distance to the waypoint. The player's world position does not land on
       * tile centres — measured live in the Vulcan Cave, tile Y sat at a
       * permanent .75 offset. Against a fractional position: the distance to an
       * integer waypoint could never fall under an arrival epsilon, so it never
       * arrived; and a one-row step registered as 0.25, under the direction
       * threshold, so it could only ever move along X. It picked a target,
       * shuffled sideways, tripped the stuck timer and picked another, forever.
       * Rounding to tiles is immune to whatever the offset happens to be.
       */
      const tileX = Math.round(player.x);
      const tileY = Math.round(player.y);
      const remaining = Math.abs(next.x - tileX) + Math.abs(next.y - tileY);

      if (remaining === 0) {
        path.shift();
        lastProgressAt = nowMs;
        lastDistance = Infinity;
        if (!path.length) {
          // Arrived. Stop and actually look at the thing.
          release(heldKeys);
          admireUntil = nowMs + ADMIRE_MS;
          state.status = target?.label ? `Reading ${target.label}` : "Taking it in";
          target = null;
        }
        return;
      }

      // Progress check on the same grid metric: if the tile distance to the next
      // waypoint is not shrinking, something unmodelled is in the way (furniture,
      // terrain blocking). Pick a new destination rather than grinding against it
      // in front of strangers.
      if (remaining < lastDistance) {
        lastDistance = remaining;
        lastProgressAt = nowMs;
      } else if (nowMs - lastProgressAt > STUCK_MS) {
        path = [];
        retarget(player, nowMs);
        return;
      }

      // Top-down movement is world-axis: W is -Z (north), D is +X (east). The
      // controller normalizes diagonals, so holding two keys is safe.
      release(heldKeys);
      if (next.y < tileY) heldKeys.add("KeyW");
      else if (next.y > tileY) heldKeys.add("KeyS");
      if (next.x > tileX) heldKeys.add("KeyD");
      else if (next.x < tileX) heldKeys.add("KeyA");
    },
  };
}
