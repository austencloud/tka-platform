/**
 * Per-channel camera curves.
 *
 * The Film Director's resolved camera has always been a list of fused
 * keyframes: one `atSeconds` carrying position, target, fov, roll, ONE
 * interpolation and ONE easing. That shape makes every axis a passenger of
 * every other. You cannot ease a zoom differently from the dolly under it,
 * you cannot key the lens without keying the framing, and no single value has
 * a timeline of its own.
 *
 * This module is the representation that fixes it. A channel is one scalar
 * over time. A frame is what you get when you sample every channel at the
 * same instant and reassemble them.
 *
 * Design and rationale:
 * `docs/superpowers/specs/active/2026-09-02-film-director-channel-architecture-design.md`
 * Evidence: `docs/architecture/film-director-research-canon.md`
 *
 * ## Why this file reproduces the old sampler exactly
 *
 * Phase 1 of that design is a pure refactor, and its gate is that
 * `camera-sampling-snapshot.test.ts` does not move by a single digit. So the
 * per-channel sampler below is deliberately a faithful restatement of the
 * fused one, including the parts that look like quirks:
 *
 *   - Catmull-Rom reads two keys either side of the straddling pair, so
 *     neighbour selection is behaviour, not an implementation detail.
 *   - A `step` key is a cut, and the spline on either side of a cut must not
 *     bend toward framing that belongs to a different shot.
 *   - Lens scalars hold a flat segment exactly; spatial axes do not, because a
 *     per-axis short-circuit there would flatten curved travel.
 *
 * Do not "clean up" any of those without a snapshot diff you can justify.
 */
import { applyDirectorEasing } from "./director-easing";
import type {
  DirectorEasing,
  DirectorInterpolation,
  ResolvedDirectorCameraKeyframe,
} from "./film-director-schema";

/**
 * Channel addresses are dotted paths so they sort, grep, and group by prefix.
 * The set is closed for now because the camera is the only channelised
 * subject; performers arrive in a later phase.
 */
export const CAMERA_CHANNEL_IDS = [
  "camera.position.x",
  "camera.position.y",
  "camera.position.z",
  "camera.target.x",
  "camera.target.y",
  "camera.target.z",
  "camera.lens.fov",
  "camera.roll",
] as const;

export type CameraChannelId = (typeof CAMERA_CHANNEL_IDS)[number];

/**
 * Layers compose bottom to top and the topmost layer that owns a channel wins
 * that channel entirely (decision D2, copy-on-write). Only `base` is populated
 * today; `directive` and `manual` are the seams the next phases write into.
 * Composition is exercised now precisely so that later phases inherit a path
 * that is already proven rather than one invented alongside them.
 */
export const CAMERA_LAYER_NAMES = ["base", "directive", "manual"] as const;

export type CameraLayerName = (typeof CAMERA_LAYER_NAMES)[number];

export interface CameraChannelKey {
  t: number;
  v: number;
  interpolation: DirectorInterpolation;
  easing: DirectorEasing;
}

export interface CameraChannel {
  id: CameraChannelId;
  /**
   * Lens semantics: a segment whose endpoints are equal returns that value
   * exactly instead of letting Catmull-Rom bow it toward its neighbours. True
   * for fov and roll, false for the spatial axes. This is a property of the
   * channel, which is the point: the fused keyframe could only express it as
   * a special case in the sampler.
   */
  holdsFlat: boolean;
  /** Sorted by `t`, never empty. */
  keys: CameraChannelKey[];
}

export interface CameraChannelStore {
  layers: Map<CameraLayerName, Map<CameraChannelId, CameraChannel>>;
}

/** Which channels hold a flat segment exactly. See `CameraChannel.holdsFlat`. */
const LENS_CHANNELS: ReadonlySet<CameraChannelId> = new Set([
  "camera.lens.fov",
  "camera.roll",
]);

function readChannelValue(
  frame: ResolvedDirectorCameraKeyframe,
  id: CameraChannelId
): number {
  switch (id) {
    case "camera.position.x":
      return frame.position[0];
    case "camera.position.y":
      return frame.position[1];
    case "camera.position.z":
      return frame.position[2];
    case "camera.target.x":
      return frame.target[0];
    case "camera.target.y":
      return frame.target[1];
    case "camera.target.z":
      return frame.target[2];
    case "camera.lens.fov":
      return frame.fovDeg;
    case "camera.roll":
      // Roll is optional on a keyframe and level is the absence of it, so the
      // channel carries the resolved 0 rather than a hole.
      return frame.rollDeg ?? 0;
  }
}

/**
 * Explode fused keyframes into one channel per scalar.
 *
 * Every channel is keyed at the same times as the source keyframes, which is
 * what makes this exchange lossless: Catmull-Rom neighbour selection depends
 * on key times, so channels that share them sample identically to the fused
 * track they came from. Later phases may key channels independently; that is a
 * deliberate behaviour change and gets its own snapshot diff.
 */
export function buildCameraChannels(
  keyframes: readonly ResolvedDirectorCameraKeyframe[]
): CameraChannelStore {
  const base = new Map<CameraChannelId, CameraChannel>();
  // A channel with no keys is not a channel. Leaving the layer empty is what
  // lets an unauthored camera fall back to the default frame rather than
  // sampling zeroes out of empty key arrays.
  for (const id of keyframes.length === 0 ? [] : CAMERA_CHANNEL_IDS) {
    base.set(id, {
      id,
      holdsFlat: LENS_CHANNELS.has(id),
      keys: keyframes.map((frame) => ({
        t: frame.atSeconds,
        v: readChannelValue(frame, id),
        interpolation: frame.interpolation,
        easing: frame.easing,
      })),
    });
  }
  const layers = new Map<
    CameraLayerName,
    Map<CameraChannelId, CameraChannel>
  >();
  layers.set("base", base);
  return { layers };
}

/**
 * The topmost layer that owns `id`, or undefined when no layer does.
 * Decision D2: ownership is per channel and whole, never per key.
 */
export function resolveChannel(
  store: CameraChannelStore,
  id: CameraChannelId
): CameraChannel | undefined {
  for (let index = CAMERA_LAYER_NAMES.length - 1; index >= 0; index -= 1) {
    const channel = store.layers.get(CAMERA_LAYER_NAMES[index]!)?.get(id);
    if (channel) return channel;
  }
  return undefined;
}

/** Catmull-Rom through four keys, or a straight line when not smoothing. */
function interpolateChannelScalar(
  before: number,
  start: number,
  end: number,
  after: number,
  progress: number,
  smooth: boolean
): number {
  if (!smooth) return start + (end - start) * progress;
  const p2 = progress * progress;
  const p3 = p2 * progress;
  return (
    0.5 *
    (2 * start +
      (-before + end) * progress +
      (2 * before - 5 * start + 4 * end - after) * p2 +
      (-before + 3 * start - 3 * end + after) * p3)
  );
}

/**
 * Sample one channel. Clamps flat outside its first and last key, cuts on a
 * `step` key, and otherwise eases across the straddling pair with the two
 * outer keys shaping the spline.
 */
export function sampleCameraChannel(
  channel: CameraChannel,
  atSeconds: number
): number {
  const keys = channel.keys;
  const first = keys[0];
  if (!first) return 0;
  if (keys.length === 1 || atSeconds <= first.t) return first.v;

  const last = keys.at(-1)!;
  if (atSeconds >= last.t) return last.v;

  const endIndex = keys.findIndex((key) => key.t > atSeconds);
  const startIndex = Math.max(0, endIndex - 1);
  const start = keys[startIndex]!;
  const end = keys[endIndex]!;
  if (start.interpolation === "step") return start.v;

  const duration = Math.max(0.0001, end.t - start.t);
  const linearProgress = Math.max(
    0,
    Math.min(1, (atSeconds - start.t) / duration)
  );
  const progress = applyDirectorEasing(linearProgress, start.easing);

  let before = keys[Math.max(0, startIndex - 1)] ?? start;
  let after = keys[Math.min(keys.length - 1, endIndex + 1)] ?? end;
  // A cut on either side must not bend this segment toward a different shot.
  if (before.interpolation === "step") before = start;
  if (end.interpolation === "step") after = end;

  if (channel.holdsFlat && start.v === end.v) return start.v;

  return interpolateChannelScalar(
    before.v,
    start.v,
    end.v,
    after.v,
    progress,
    start.interpolation === "smooth"
  );
}

/** Sample a channel through the layer stack, or fall back when unowned. */
export function sampleStoreChannel(
  store: CameraChannelStore,
  id: CameraChannelId,
  atSeconds: number,
  fallback: number
): number {
  const channel = resolveChannel(store, id);
  return channel ? sampleCameraChannel(channel, atSeconds) : fallback;
}

/**
 * One instant of camera, reassembled from every channel.
 *
 * This is the boundary the rest of the Film Director sees. Channels are how the
 * camera is stored and edited; a frame is what the viewer consumes.
 */
export interface DirectorCameraFrame {
  position: [number, number, number];
  target: [number, number, number];
  fovDeg: number;
  /** Horizon tilt, degrees; positive = clockwise on screen. Always present (0 = level). */
  rollDeg: number;
}

/** What an unauthored camera looks like: eye level, slightly back, 50mm-ish. */
const DEFAULT_CAMERA_FRAME: DirectorCameraFrame = {
  position: [0, 1, -4],
  target: [0, 0, 0],
  fovDeg: 50,
  rollDeg: 0,
};

/** Sample every camera channel at one instant and assemble the frame. */
export function sampleCameraFrame(
  store: CameraChannelStore,
  atSeconds: number
): DirectorCameraFrame {
  const read = (id: CameraChannelId, fallback: number) =>
    sampleStoreChannel(store, id, atSeconds, fallback);
  const fallback = DEFAULT_CAMERA_FRAME;
  return {
    position: [
      read("camera.position.x", fallback.position[0]),
      read("camera.position.y", fallback.position[1]),
      read("camera.position.z", fallback.position[2]),
    ],
    target: [
      read("camera.target.x", fallback.target[0]),
      read("camera.target.y", fallback.target[1]),
      read("camera.target.z", fallback.target[2]),
    ],
    fovDeg: read("camera.lens.fov", fallback.fovDeg),
    rollDeg: read("camera.roll", fallback.rollDeg),
  };
}
