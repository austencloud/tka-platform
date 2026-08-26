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

export type DirectorBlockingVerb = "stand" | "walk" | "turn";

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

export interface DirectorBlockingMove {
  move: DirectorBlockingVerb;
  to?: { x: number; z: number };
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
  }
> = {
  stand: { unit: null, directions: null, takesDestination: false },
  walk: {
    unit: "meters",
    directions: ["forward", "backward", "left", "right"],
    takesDestination: true,
  },
  turn: { unit: "degrees", directions: ["left", "right"], takesDestination: false },
};

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
    assertWalkable(delta, end - start, context.performerId);

    // A relative direction already says which way the body goes, so holding
    // the facing is what makes "walk backward" back up instead of turning
    // around. A walk to a mark has no such statement, so the performer looks
    // where they are going.
    const requested = move.facing ?? (move.to ? "travel" : "hold");
    const nextFacing = resolveWalkFacing(requested, delta, facingAngle);

    push(start, position, facingAngle, true);
    push(end, destination, nextFacing, false);
    position = destination;
    facingAngle = nextFacing;
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
  const rules = MOVE_RULES[move.move];
  const where = `Performer "${performerId}": "${move.move}"`;

  if (move.to && !rules.takesDestination) {
    throw new Error(`${where} does not take a destination.`);
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

function assertWalkable(
  delta: { x: number; z: number },
  windowSeconds: number,
  performerId: string
): void {
  const distance = Math.hypot(delta.x, delta.z);
  if (distance < 1e-6) return;
  const speed = windowSeconds > 0 ? distance / windowSeconds : Infinity;
  if (speed <= MAX_TRAVEL_SPEED) return;
  throw new Error(
    `Performer "${performerId}" would cover ${distance.toFixed(2)}m in ${windowSeconds.toFixed(2)}s (${speed.toFixed(2)} m/s). Travel tops out at ${MAX_TRAVEL_SPEED} m/s — give the move more time or a shorter distance.`
  );
}
