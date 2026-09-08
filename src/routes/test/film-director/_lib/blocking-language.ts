/**
 * Blocking — where each performer stands, and how they travel while the scene
 * plays.
 *
 * The grammar mirrors `camera-language.ts`: a list of moves, each optionally
 * carrying an amount, a direction, and a window, compiled into keyframes. Same
 * shapes, same validation, same time allocation.
 *
 * `direction` is PERFORMER-relative — "left" is the performer's own left, not
 * the audience's. A move that needs a stage-absolute destination uses `to`,
 * which names a world point.
 */
import type { DirectorEasing } from "./film-director-schema";
import { allocateMoveWindows } from "./director-move-windows";

export type DirectorBlockingVerb = "stand" | "walk" | "turn" | "run";

export type DirectorBlockingDirection =
  | "forward"
  | "backward"
  | "left"
  | "right";

export type DirectorBlockingFacing =
  | "travel"
  | "hold"
  | "audience"
  | { degrees: number };

export interface DirectorBlockingPath {
  /** The side the path bows toward, from the traveller's own point of view. */
  arc: "left" | "right";
  /**
   * The sagitta as a fraction of the straight-line chord. 0.5 (the default)
   * bows the walk into a half circle; 1.5 is the widest loop the grammar
   * allows. The schema bounds it to (0, 1.5].
   */
  bulge?: number;
}

export interface DirectorBlockingMove {
  move: DirectorBlockingVerb;
  to?: { x: number; z: number };
  along?: DirectorBlockingPath;
  direction?: DirectorBlockingDirection;
  amount?: { meters: number } | { degrees: number };
  facing?: DirectorBlockingFacing;
  durationSeconds?: number;
  easing?: DirectorEasing;
}

export interface ResolvedDirectorBlockingKeyframe {
  atSeconds: number;
  position: { x: number; z: number };
  facingAngle: number;
  /** Whether the segment that STARTS at this keyframe is a walk. */
  walking: boolean;
  easing: DirectorEasing;
}

export interface BlockingContext {
  durationSeconds: number;
  performerId: string;
  startPosition: { x: number; z: number };
  startFacingAngle: number;
}

/**
 * Facing the camera side of the stage. Every director camera fronts the group
 * from -Z (see `buildResolvedPerformers`), and facing angle 0 looks down +Z.
 */
export const AUDIENCE_FACING_ANGLE = Math.PI;

/**
 * A brisk walk is about 1.4 m/s and a jog about 2.5. Past this the walk clip
 * can no longer be sped up to match the ground and the feet skate.
 */
export const MAX_TRAVEL_SPEED = 2.6;

const DEFAULT_WALK_METERS = 2;
const DEFAULT_TURN_DEGREES = 90;

const MOVE_RULES: Record<
  DirectorBlockingVerb,
  {
    unit: "meters" | "degrees" | null;
    directions: readonly DirectorBlockingDirection[] | null;
    takesDestination: boolean;
    takesPath: boolean;
  }
> = {
  stand: {
    unit: null,
    directions: null,
    takesDestination: false,
    takesPath: false,
  },
  walk: {
    unit: "meters",
    directions: ["forward", "backward", "left", "right"],
    takesDestination: true,
    takesPath: true,
  },
  turn: {
    unit: "degrees",
    directions: ["left", "right"],
    takesDestination: false,
    takesPath: false,
  },
  // Reachable only through the rejection in `validateBlockingMove`; a run has
  // no rules because there is no run.
  run: {
    unit: null,
    directions: null,
    takesDestination: false,
    takesPath: false,
  },
};

const DEFAULT_ARC_BULGE = 0.5;
/** Target chord length. Shorter chords are a smoother curve and more keyframes. */
const ARC_CHORD_METERS = 0.5;
const MIN_ARC_CHORDS = 4;
const MAX_ARC_CHORDS = 16;

interface ArcPath {
  /** Chord endpoints in order, `points[0]` the start and the last the mark. */
  points: { x: number; z: number }[];
  /** Travel-tangent facing at each point, same length as `points`. */
  tangents: number[];
  /** Distance along the curve, which is what the speed check must read. */
  length: number;
}

/**
 * The circular arc from `start` to `end` that bows `bulge` chord-fractions to
 * the traveller's `side`, sampled into chords.
 *
 * The circle is the one through both endpoints whose sagitta (the height of
 * the arc above the middle of the chord) is `bulge * chord`. For sagitta `h`
 * and chord `c` the radius is `(c^2/4 + h^2) / (2h)`, and the centre sits at
 * `midpoint + (h - R) * u`, where `u` is the unit vector pointing to the side
 * the arc bows toward: that expression puts the centre behind the chord for a
 * shallow bow and in front of it for a reflex one, with no case split.
 *
 * Facing angle 0 looks down +Z and increases clockwise from above, so for a
 * unit travel direction `f` the traveller's right is `(f.z, -f.x)` and their
 * left is `(-f.z, f.x)` — the same convention `offsetFrom` uses.
 */
function arcPath(
  start: { x: number; z: number },
  end: { x: number; z: number },
  path: DirectorBlockingPath
): ArcPath {
  const chordX = end.x - start.x;
  const chordZ = end.z - start.z;
  const chord = Math.hypot(chordX, chordZ);
  const forward = { x: chordX / chord, z: chordZ / chord };
  const side =
    path.arc === "right"
      ? { x: forward.z, z: -forward.x }
      : { x: -forward.z, z: forward.x };

  const sagitta = (path.bulge ?? DEFAULT_ARC_BULGE) * chord;
  const radius = (chord * chord * 0.25 + sagitta * sagitta) / (2 * sagitta);
  const mid = { x: start.x + chordX * 0.5, z: start.z + chordZ * 0.5 };
  const centre = {
    x: mid.x + side.x * (sagitta - radius),
    z: mid.z + side.z * (sagitta - radius),
  };

  const startAngle = Math.atan2(start.z - centre.z, start.x - centre.x);
  const endAngle = Math.atan2(end.z - centre.z, end.x - centre.x);
  // The minor sweep between the two endpoints, then the major one if the
  // minor sweep bows the wrong way — which is exactly the reflex case
  // (bulge > 1), where the arc's own midpoint is further from the centre's
  // side than the chord is.
  let sweep = endAngle - startAngle;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  const probe = startAngle + sweep * 0.5;
  const probePoint = {
    x: centre.x + radius * Math.cos(probe),
    z: centre.z + radius * Math.sin(probe),
  };
  const bowsCorrectly =
    (probePoint.x - mid.x) * side.x + (probePoint.z - mid.z) * side.z > 0;
  if (!bowsCorrectly) sweep -= Math.sign(sweep) * 2 * Math.PI;

  const length = Math.abs(sweep) * radius;
  const chords = Math.min(
    MAX_ARC_CHORDS,
    Math.max(MIN_ARC_CHORDS, Math.ceil(length / ARC_CHORD_METERS))
  );

  const points: { x: number; z: number }[] = [];
  const tangents: number[] = [];
  for (let step = 0; step <= chords; step += 1) {
    const angle = startAngle + (sweep * step) / chords;
    points.push({
      x: centre.x + radius * Math.cos(angle),
      z: centre.z + radius * Math.sin(angle),
    });
    // The tangent is the derivative of the point in the direction of travel,
    // which flips with the sign of the sweep.
    const tangent =
      sweep >= 0
        ? { x: -Math.sin(angle), z: Math.cos(angle) }
        : { x: Math.sin(angle), z: -Math.cos(angle) };
    // `atan2` wraps to (-pi, pi], which would put a 2*pi jump in the middle of
    // a curve that actually turns smoothly. Unwrap against the previous
    // tangent so the series advances by one equal step per chord and a later
    // `turn` adds its degrees to a continuous angle.
    const previous = tangents.at(-1);
    let facing = Math.atan2(tangent.x, tangent.z);
    if (previous !== undefined) {
      while (facing - previous > Math.PI) facing -= 2 * Math.PI;
      while (facing - previous <= -Math.PI) facing += 2 * Math.PI;
    }
    tangents.push(facing);
  }
  // Float error accumulates over sixteen cosines; the mark is exact by
  // construction, so state it rather than approach it.
  points[0] = { ...start };
  points[points.length - 1] = { ...end };
  return { points, tangents, length };
}

/** Turn `from` into `to` along the shortest way round, for a fraction `t`. */
function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  return from + delta * t;
}

export function compileBlockingMoves(
  moves: readonly DirectorBlockingMove[],
  context: BlockingContext
): ResolvedDirectorBlockingKeyframe[] {
  const startFrame = (atSeconds: number): ResolvedDirectorBlockingKeyframe => ({
    atSeconds,
    position: { ...context.startPosition },
    facingAngle: context.startFacingAngle,
    walking: false,
    easing: "linear",
  });
  if (moves.length === 0) {
    return [startFrame(0), startFrame(context.durationSeconds)];
  }

  const windows = allocateMoveWindows(
    moves,
    context.durationSeconds,
    `Performer "${context.performerId}" blocking moves`
  );
  const frames: ResolvedDirectorBlockingKeyframe[] = [];
  let position = { ...context.startPosition };
  let facingAngle = context.startFacingAngle;

  moves.forEach((move, index) => {
    validateBlockingMove(move, context.performerId);
    const { start, end } = windows[index]!;
    // Constant speed by default, unlike the camera's ease-in-out: the walk
    // clip's playback rate tracks ground speed, so a ramp at either end of a
    // travel is a ramp into feet that slide.
    const easing = move.easing ?? "linear";
    const push = (
      atSeconds: number,
      pose: { x: number; z: number },
      facing: number,
      walking: boolean
    ) => {
      const last = frames.at(-1);
      if (last && Math.abs(last.atSeconds - atSeconds) < 1e-6) frames.pop();
      frames.push({
        atSeconds,
        position: { ...pose },
        facingAngle: facing,
        walking,
        easing,
      });
    };

    if (move.move === "stand") {
      push(start, position, facingAngle, false);
      push(end, position, facingAngle, false);
      return;
    }

    if (move.move === "turn") {
      const next = resolveTurnFacing(move, facingAngle, context.performerId);
      push(start, position, facingAngle, false);
      push(end, position, next, false);
      facingAngle = next;
      return;
    }

    const destination = move.to
      ? { ...move.to }
      : offsetFrom(
          position,
          facingAngle,
          move.direction ?? "forward",
          move.amount && "meters" in move.amount
            ? move.amount.meters
            : DEFAULT_WALK_METERS
        );
    const delta = {
      x: destination.x - position.x,
      z: destination.z - position.z,
    };

    // A relative direction already says which way the body goes, so holding
    // the facing is what makes "walk backward" back up instead of turning
    // around. A walk to a mark has no such statement, so the performer looks
    // where they are going.
    const requested = move.facing ?? (move.to ? "travel" : "hold");
    const nextFacing = resolveWalkFacing(requested, delta, facingAngle);

    if (!move.along || Math.hypot(delta.x, delta.z) < 1e-6) {
      assertWalkable(
        Math.hypot(delta.x, delta.z),
        end - start,
        context.performerId
      );
      push(start, position, facingAngle, true);
      push(end, destination, nextFacing, false);
      position = destination;
      facingAngle = nextFacing;
      return;
    }

    const arc = arcPath(position, destination, move.along);
    assertWalkable(arc.length, end - start, context.performerId);
    // Equal angle steps are equal arc lengths, so equal time steps are a
    // constant ground speed — the same thing the straight walk gives the
    // locomotion animator.
    arc.points.forEach((point, step) => {
      const t = step / (arc.points.length - 1);
      const facing =
        requested === "travel"
          ? arc.tangents[step]!
          : lerpAngle(facingAngle, nextFacing, t);
      push(
        start + (end - start) * t,
        point,
        facing,
        step < arc.points.length - 1
      );
    });
    // `nextFacing` for "travel" comes from the chord, which is the tangent at
    // the far end of the curve only by coincidence. Take the arc's own.
    position = destination;
    facingAngle = requested === "travel" ? arc.tangents.at(-1)! : nextFacing;
  });

  // Moves whose durations are all stated can add up to less than the scene.
  // The leftover is a hold on the last pose, not an early end to the track.
  const last = frames.at(-1)!;
  if (last.atSeconds < context.durationSeconds - 1e-6) {
    frames.push({
      ...last,
      position: { ...last.position },
      atSeconds: context.durationSeconds,
    });
  }
  return frames;
}

function validateBlockingMove(
  move: DirectorBlockingMove,
  performerId: string
): void {
  if (move.move === "run") {
    throw new Error(
      `Performer "${performerId}": "run" is not a gait the 3D locomotion has. There is one walk clip, time-warped to the ground, and past ${fmt(MAX_TRAVEL_SPEED)} m/s the feet skate. Write a "walk".`
    );
  }

  const rules = MOVE_RULES[move.move];
  const where = `Performer "${performerId}": "${move.move}"`;

  if (move.to && !rules.takesDestination) {
    throw new Error(`${where} does not take a destination.`);
  }
  if (move.along && !rules.takesPath) {
    throw new Error(`${where} does not take a path.`);
  }
  if (move.to && (move.direction || move.amount)) {
    throw new Error(
      `${where} takes either a destination or a direction and amount, not both.`
    );
  }
  if (move.amount) {
    const unit = "degrees" in move.amount ? "degrees" : "meters";
    if (rules.unit === null) {
      throw new Error(`${where} does not take an amount.`);
    }
    if (unit !== rules.unit) {
      throw new Error(`${where} takes ${rules.unit}, not ${unit}.`);
    }
  }
  if (move.direction) {
    if (!rules.directions) {
      throw new Error(`${where} does not take a direction.`);
    }
    if (!rules.directions.includes(move.direction)) {
      throw new Error(
        `${where} direction must be one of ${rules.directions.join("/")}, got "${move.direction}".`
      );
    }
  }
  if (move.facing && move.move === "stand") {
    throw new Error(`${where} does not take a facing — use "turn".`);
  }
}

function resolveTurnFacing(
  move: DirectorBlockingMove,
  current: number,
  performerId: string
): number {
  const facing = move.facing;
  if (facing !== undefined && facing !== "hold") {
    if (facing === "travel") {
      throw new Error(
        `Performer "${performerId}": "turn" cannot face "travel" — a turn does not travel.`
      );
    }
    return absoluteFacing(facing);
  }
  if (!move.direction) {
    throw new Error(
      `Performer "${performerId}": "turn" needs a direction (left/right) or a facing.`
    );
  }
  const degrees =
    (move.amount && "degrees" in move.amount
      ? move.amount.degrees
      : DEFAULT_TURN_DEGREES) * (move.direction === "left" ? -1 : 1);
  return current + (degrees * Math.PI) / 180;
}

function resolveWalkFacing(
  facing: DirectorBlockingFacing,
  delta: { x: number; z: number },
  current: number
): number {
  if (facing === "hold") return current;
  if (facing === "travel") {
    return Math.hypot(delta.x, delta.z) < 1e-6
      ? current
      : Math.atan2(delta.x, delta.z);
  }
  return absoluteFacing(facing);
}

function absoluteFacing(facing: "audience" | { degrees: number }): number {
  return facing === "audience"
    ? AUDIENCE_FACING_ANGLE
    : (facing.degrees * Math.PI) / 180;
}

/**
 * Facing angle 0 looks down +Z, and the angle increases clockwise seen from
 * above — so the performer's forward is (sin, cos) and their right is
 * (cos, -sin).
 */
function offsetFrom(
  position: { x: number; z: number },
  facingAngle: number,
  direction: DirectorBlockingDirection,
  meters: number
): { x: number; z: number } {
  const sin = Math.sin(facingAngle);
  const cos = Math.cos(facingAngle);
  const axis =
    direction === "forward"
      ? { x: sin, z: cos }
      : direction === "backward"
        ? { x: -sin, z: -cos }
        : direction === "right"
          ? { x: cos, z: -sin }
          : { x: -cos, z: sin };
  return {
    x: position.x + axis.x * meters,
    z: position.z + axis.z * meters,
  };
}

/** Two-decimal display for a user-facing seconds/meters value — matches
 * director-move-windows.ts's helper of the same name and intent. */
const fmt = (n: number): string => String(Number(n.toFixed(2)));

function assertWalkable(
  distance: number,
  windowSeconds: number,
  performerId: string
): void {
  if (distance < 1e-6) return;
  const speed = windowSeconds > 0 ? distance / windowSeconds : Infinity;
  if (speed <= MAX_TRAVEL_SPEED) return;
  throw new Error(
    `Performer "${performerId}" would cover ${fmt(distance)}m in ${fmt(windowSeconds)}s (${fmt(speed)} m/s). Travel tops out at ${fmt(MAX_TRAVEL_SPEED)} m/s — give the move more time or a shorter distance.`
  );
}
