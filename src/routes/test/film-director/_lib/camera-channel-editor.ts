/**
 * What a channel row needs in order to be drawn, read and dragged.
 *
 * The channel store answers "what is this value at time t". A row asks a
 * different set of questions: what range does this scalar cover across the
 * scene, where does a key sit inside a lane, which key did the pointer land
 * on, and where may that key legally move. Those are all pure, so they live
 * here rather than inside the component, and the drag arithmetic that this
 * kind of editor always gets subtly wrong gets tested directly.
 */
import {
  sampleCameraChannel,
  type CameraChannel,
  type CameraChannelId,
} from "./director-camera-channels";
import type { ResolvedDirectorCameraChannelKey } from "./film-director-schema";

/** Two keys never sit closer than this, so a retime can never collapse a
 *  segment to zero length or make two keys share an instant. */
export const MIN_KEY_GAP_SECONDS = 0.02;

/** How near a pointer has to land, in lane fractions, to grab a key. */
const GRAB_RADIUS = 0.1;

export interface ChannelRange {
  min: number;
  max: number;
}

export interface ChannelRowGroup {
  label: string;
  ids: readonly CameraChannelId[];
}

/**
 * How the rows are grouped and named.
 *
 * Aim appears in two spellings because the camera means two different things
 * by it: a point in the world it holds on, and a direction it is turned in.
 * Both are real channels, and which one governs a segment is a property of
 * that segment, so both are shown rather than one being hidden as an
 * implementation detail of the other.
 */
export const CHANNEL_ROW_GROUPS: readonly ChannelRowGroup[] = [
  {
    label: "Rig",
    ids: ["camera.position.x", "camera.position.y", "camera.position.z"],
  },
  {
    label: "Aim point",
    ids: ["camera.target.x", "camera.target.y", "camera.target.z"],
  },
  {
    label: "Aim direction",
    ids: ["camera.aim.yaw", "camera.aim.pitch", "camera.aim.distance"],
  },
  { label: "Lens", ids: ["camera.lens.fov", "camera.roll"] },
];

interface ChannelVocabulary {
  label: string;
  unit: "meters" | "degrees";
  /** Decimal places the row shows. Angles read fine coarse; metres do not. */
  digits: number;
}

const CHANNEL_VOCABULARY: Record<CameraChannelId, ChannelVocabulary> = {
  "camera.position.x": { label: "X", unit: "meters", digits: 2 },
  "camera.position.y": { label: "Height", unit: "meters", digits: 2 },
  "camera.position.z": { label: "Z", unit: "meters", digits: 2 },
  "camera.target.x": { label: "X", unit: "meters", digits: 2 },
  "camera.target.y": { label: "Height", unit: "meters", digits: 2 },
  "camera.target.z": { label: "Z", unit: "meters", digits: 2 },
  "camera.aim.yaw": { label: "Pan", unit: "degrees", digits: 1 },
  "camera.aim.pitch": { label: "Tilt", unit: "degrees", digits: 1 },
  "camera.aim.distance": { label: "Throw", unit: "meters", digits: 2 },
  "camera.lens.fov": { label: "Zoom", unit: "degrees", digits: 1 },
  "camera.roll": { label: "Roll", unit: "degrees", digits: 1 },
};

export function channelLabel(id: CameraChannelId): string {
  return CHANNEL_VOCABULARY[id].label;
}

export function formatChannelValue(id: CameraChannelId, value: number): string {
  const { unit, digits } = CHANNEL_VOCABULARY[id];
  // A pan of -0.0001 degrees rounds to "-0.0", which reads as a real negative
  // and flickers a minus sign on and off as the playhead moves. Round first,
  // then take the sign from the rounded number.
  const rounded = Number(value.toFixed(digits)) || 0;
  return `${rounded.toFixed(digits)}${unit === "meters" ? "m" : "°"}`;
}

/**
 * The range a lane draws over.
 *
 * A channel that never changes still has to draw something, so a flat one is
 * given a band around its value rather than a zero-height range that every
 * later division would blow up on. A channel that does change gets headroom,
 * so its extremes are handles inside the lane rather than pixels on its edge.
 */
export function channelRange(
  keys: readonly { v: number }[],
  padding = 0.18
): ChannelRange {
  if (keys.length === 0) return { min: -1, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const key of keys) {
    if (key.v < min) min = key.v;
    if (key.v > max) max = key.v;
  }
  const span = max - min;
  if (span < 1e-6) {
    const band = Math.max(Math.abs(max) * 0.1, 0.5);
    return { min: min - band, max: max + band };
  }
  return { min: min - span * padding, max: max + span * padding };
}

/** Lane position of a time, 0 at the scene start and 1 at its end. */
export function laneX(atSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, atSeconds / durationSeconds));
}

/** Lane position of a value, 0 at the TOP of the lane, as screens count. */
export function laneY(value: number, range: ChannelRange): number {
  const span = range.max - range.min;
  if (span <= 0) return 0.5;
  return Math.max(0, Math.min(1, 1 - (value - range.min) / span));
}

export function secondsAtLaneX(x: number, durationSeconds: number): number {
  return Math.max(0, Math.min(1, x)) * durationSeconds;
}

export function valueAtLaneY(y: number, range: ChannelRange): number {
  return range.max - Math.max(0, Math.min(1, y)) * (range.max - range.min);
}

/**
 * The key the pointer is asking for, or null when it is asking for empty lane.
 *
 * Distance is measured in lane fractions rather than pixels so one rule covers
 * a 320-pixel lane on a phone and a 1600-pixel one at 4K. Time counts double,
 * because keys are far more likely to sit close in x than in y and grabbing
 * the wrong one is worse than grabbing none.
 */
export function keyAtPointer(
  keys: readonly { t: number; v: number }[],
  pointer: { x: number; y: number },
  range: ChannelRange,
  durationSeconds: number
): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  keys.forEach((key, index) => {
    const dx = laneX(key.t, durationSeconds) - pointer.x;
    const dy = laneY(key.v, range) - pointer.y;
    const distance = Math.hypot(dx * 2, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return bestDistance <= GRAB_RADIUS * 2 ? best : null;
}

/**
 * Move one key, and return the whole channel's keys.
 *
 * Retiming is clamped between the key's neighbours rather than allowed to
 * reorder them: a drag that swapped two keys would silently rewrite which
 * segment governs which span, and the shot the director was watching would
 * change under a gesture that looked like a nudge. The ends clamp to the
 * scene, because a key outside it cannot be reached.
 */
export function moveKey(
  keys: readonly ResolvedDirectorCameraChannelKey[],
  index: number,
  atSeconds: number,
  value: number,
  durationSeconds: number
): ResolvedDirectorCameraChannelKey[] {
  const key = keys[index];
  if (!key) return [...keys];
  const lowerBound =
    index === 0 ? 0 : keys[index - 1]!.atSeconds + MIN_KEY_GAP_SECONDS;
  const upperBound =
    index === keys.length - 1
      ? durationSeconds
      : keys[index + 1]!.atSeconds - MIN_KEY_GAP_SECONDS;
  const t = Math.max(
    0,
    Math.min(Math.max(atSeconds, Math.min(lowerBound, upperBound)), upperBound)
  );
  return keys.map((existing, position) =>
    position === index ? { ...existing, atSeconds: t, value } : existing
  );
}

/**
 * The lane's curve, in lane coordinates.
 *
 * Sampled rather than drawn from the keys, because the whole point of the
 * channel model is that what happens between two keys is not a straight line:
 * a smooth segment bows toward its neighbours and a step segment does not move
 * at all. A row that joined its keys with lines would draw a different
 * animation from the one that plays.
 */
export function channelCurvePoints(
  channel: CameraChannel,
  range: ChannelRange,
  durationSeconds: number,
  samples = 96
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const value = sampleCameraChannel(channel, progress * durationSeconds);
    points.push({ x: progress, y: laneY(value, range) });
  }
  return points;
}

/**
 * An SVG path through lane-space points, scaled to a viewBox of `width` by
 * `height`. Straight between samples on purpose: the sampling is dense enough
 * to carry the curve, and a smoothed path would draw something the sampler
 * never says.
 */
export function laneCurvePath(
  points: readonly { x: number; y: number }[],
  width: number,
  height: number
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${(point.x * width).toFixed(2)} ${(
          point.y * height
        ).toFixed(2)}`
    )
    .join(" ");
}
