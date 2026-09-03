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
  "camera.aim.yaw",
  "camera.aim.pitch",
  "camera.aim.distance",
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
  /**
   * Only meaningful on `camera.aim.yaw`, and only on the key that opens a
   * segment: it says this segment's aim point is derived from the aim
   * direction rather than read from the target channels. See
   * `ResolvedDirectorCameraKeyframe.aimSpace`.
   */
  aimSpace?: "angles";
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

/** Aim channels are built by a sequential pass, not a per-key read. */
const AIM_CHANNELS: ReadonlySet<CameraChannelId> = new Set([
  "camera.aim.yaw",
  "camera.aim.pitch",
  "camera.aim.distance",
]);

/** Whether `id` addresses a camera channel. Narrows arbitrary strings. */
export function isCameraChannelId(value: string): value is CameraChannelId {
  return (CAMERA_CHANNEL_IDS as readonly string[]).includes(value);
}

/**
 * Whether this channel holds a flat segment exactly. See `CameraChannel`.
 * Aim is angular and a stated hold in it is a hold, for the same reason the
 * lens channels hold: a pan that pauses should not drift while it waits.
 */
export function holdsFlatForChannel(id: CameraChannelId): boolean {
  return LENS_CHANNELS.has(id) || AIM_CHANNELS.has(id);
}

/**
 * The channels that have to change owner together with `id`.
 *
 * Yaw, pitch and distance are one aim expressed in three scalars, and the
 * segment's aim space is carried by the yaw channel. Taking yaw into the
 * manual layer while pitch and distance stayed below would leave the aim half
 * derived and half measured, so the group moves as one. Every other channel
 * stands alone: a hand-keyed `camera.target.x` composes perfectly well with a
 * `camera.target.y` that nobody has touched.
 */
export function cameraChannelGroup(
  id: CameraChannelId
): readonly CameraChannelId[] {
  return AIM_CHANNELS.has(id)
    ? ["camera.aim.yaw", "camera.aim.pitch", "camera.aim.distance"]
    : [id];
}

/**
 * A channel as the document states it. Authored times are seconds from the
 * scene's start, which is the unit a drag produces; a manual key deliberately
 * does not speak the beat and cue vocabulary that `cameraKeyframeSchema` does,
 * because a hand-placed key that moved when the tempo changed would be a
 * surprise rather than a feature.
 */
export interface ManualCameraChannel {
  id: CameraChannelId;
  keys: readonly {
    atSeconds: number;
    value: number;
    interpolation: DirectorInterpolation;
    easing: DirectorEasing;
  }[];
}

function readChannelValue(
  frame: ResolvedDirectorCameraKeyframe,
  id: CameraChannelId
): number {
  switch (id) {
    case "camera.aim.yaw":
    case "camera.aim.pitch":
    case "camera.aim.distance":
      // Unreachable: buildCameraChannels routes these through buildAimChannels.
      return 0;
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
 * Yaw, pitch and distance for every keyframe.
 *
 * A keyframe authored by a turn states its own yaw, because `atan2` cannot
 * tell a turn of 270 degrees from one of -90 and recovering the angle from the
 * endpoint would silently shorten the move. Every other keyframe has its aim
 * measured from position and target, then unwrapped against the key before it
 * so a spline never takes the long way round a seam at +-180 degrees.
 */
function buildAimChannels(
  keyframes: readonly ResolvedDirectorCameraKeyframe[]
): CameraChannel[] {
  const yaw: CameraChannelKey[] = [];
  const pitch: CameraChannelKey[] = [];
  const distance: CameraChannelKey[] = [];

  let previousYaw: number | undefined;
  for (const frame of keyframes) {
    const dx = frame.target[0] - frame.position[0];
    const dy = frame.target[1] - frame.position[1];
    const dz = frame.target[2] - frame.position[2];
    const length = Math.hypot(dx, dy, dz);

    const measuredYaw = length < 1e-9 ? 0 : (Math.atan2(dx, dz) * 180) / Math.PI;
    const measuredPitch =
      length < 1e-9
        ? 0
        : (Math.asin(Math.max(-1, Math.min(1, dy / length))) * 180) / Math.PI;

    // Unwrapping is for MEASURED angles only. A stated one already knows which
    // way round it went, and folding it toward its neighbour is exactly the
    // loss the compiler stated it to avoid.
    let yawValue = frame.aimYawDeg;
    if (yawValue === undefined) {
      yawValue = measuredYaw;
      if (previousYaw !== undefined) {
        yawValue += Math.round((previousYaw - yawValue) / 360) * 360;
      }
    }
    previousYaw = yawValue;

    const shared = {
      t: frame.atSeconds,
      interpolation: frame.interpolation,
      easing: frame.easing,
    };
    yaw.push({
      ...shared,
      v: yawValue,
      ...(frame.aimSpace ? { aimSpace: frame.aimSpace } : {}),
    });
    pitch.push({ ...shared, v: frame.aimPitchDeg ?? measuredPitch });
    distance.push({ ...shared, v: length });
  }

  // A stated hold in aim is a hold: the same argument the lens channels make,
  // and the reason a pan that pauses does not drift while it waits.
  return [
    { id: "camera.aim.yaw", holdsFlat: holdsFlatForChannel("camera.aim.yaw"), keys: yaw },
    {
      id: "camera.aim.pitch",
      holdsFlat: holdsFlatForChannel("camera.aim.pitch"),
      keys: pitch,
    },
    {
      id: "camera.aim.distance",
      holdsFlat: holdsFlatForChannel("camera.aim.distance"),
      keys: distance,
    },
  ];
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
  keyframes: readonly ResolvedDirectorCameraKeyframe[],
  manual?: readonly ManualCameraChannel[]
): CameraChannelStore {
  const base = new Map<CameraChannelId, CameraChannel>();
  // A channel with no keys is not a channel. Leaving the layer empty is what
  // lets an unauthored camera fall back to the default frame rather than
  // sampling zeroes out of empty key arrays.
  for (const id of keyframes.length === 0 ? [] : CAMERA_CHANNEL_IDS) {
    if (AIM_CHANNELS.has(id)) continue;
    base.set(id, {
      id,
      holdsFlat: holdsFlatForChannel(id),
      keys: keyframes.map((frame) => ({
        t: frame.atSeconds,
        v: readChannelValue(frame, id),
        interpolation: frame.interpolation,
        easing: frame.easing,
      })),
    });
  }
  if (keyframes.length > 0) {
    for (const channel of buildAimChannels(keyframes)) base.set(channel.id, channel);
  }
  const layers = new Map<
    CameraLayerName,
    Map<CameraChannelId, CameraChannel>
  >();
  layers.set("base", base);
  if (manual?.length) layers.set("manual", buildManualLayer(manual));
  return { layers };
}

/**
 * The hand-authored layer.
 *
 * A manual yaw channel stamps `aimSpace` on every key, which is what makes
 * hand-keying the aim direction visible: without it the derived aim point
 * would be assembled and then thrown away in favour of the target channels
 * underneath, and dragging a yaw key would appear to do nothing.
 */
function buildManualLayer(
  manual: readonly ManualCameraChannel[]
): Map<CameraChannelId, CameraChannel> {
  const layer = new Map<CameraChannelId, CameraChannel>();
  for (const channel of manual) {
    if (channel.keys.length === 0) continue;
    const angular = channel.id === "camera.aim.yaw";
    layer.set(channel.id, {
      id: channel.id,
      holdsFlat: holdsFlatForChannel(channel.id),
      keys: [...channel.keys]
        .sort((left, right) => left.atSeconds - right.atSeconds)
        .map((key) => ({
          t: key.atSeconds,
          v: key.value,
          interpolation: key.interpolation,
          easing: key.easing,
          ...(angular ? { aimSpace: "angles" as const } : {}),
        })),
    });
  }
  return layer;
}

/**
 * The keys a manual channel starts from when it takes ownership.
 *
 * Decision D2 is copy-on-write per channel: the topmost owner takes the whole
 * channel, seeded from what composed underneath it, so the first edit changes
 * exactly one key and nothing else moves. A channel no layer owns seeds as a
 * single key at zero holding `fallback`, which is the honest reading of "this
 * value was never authored".
 */
export function seedManualChannel(
  store: CameraChannelStore,
  id: CameraChannelId,
  fallback = 0
): ManualCameraChannel {
  const composed = resolveChannel(store, id);
  if (!composed) {
    return {
      id,
      keys: [
        {
          atSeconds: 0,
          value: fallback,
          interpolation: "smooth",
          easing: "ease-in-out",
        },
      ],
    };
  }
  return {
    id,
    keys: composed.keys.map((key) => ({
      atSeconds: key.t,
      value: key.v,
      interpolation: key.interpolation,
      easing: key.easing,
    })),
  };
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
 * The key whose outgoing segment contains `atSeconds`, clamped to the track.
 * A key governs the span that starts at it, which is why `interpolation` and
 * `aimSpace` are read from the key BEFORE the instant being sampled.
 */
export function governingKeyIndex(
  keys: readonly CameraChannelKey[],
  atSeconds: number
): number {
  if (keys.length === 0) return -1;
  if (atSeconds <= keys[0]!.t) return 0;
  const last = keys.length - 1;
  if (atSeconds >= keys[last]!.t) return last;
  return keys.findIndex((key) => key.t > atSeconds) - 1;
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
  const startIndex = governingKeyIndex(keys, atSeconds);
  if (startIndex < 0) return 0;
  const start = keys[startIndex]!;
  // Outside the track at either end, or standing on the final key.
  if (startIndex === keys.length - 1 || atSeconds <= keys[0]!.t) return start.v;
  if (start.interpolation === "step") return start.v;

  const endIndex = startIndex + 1;
  const end = keys[endIndex]!;

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

/**
 * Whether the segment containing `atSeconds` aims by direction rather than by
 * point. The yaw channel carries the flag, because it is the channel that
 * becomes load-bearing when it is set.
 */
function aimsByAngle(store: CameraChannelStore, atSeconds: number): boolean {
  const yaw = resolveChannel(store, "camera.aim.yaw");
  if (!yaw) return false;
  const index = governingKeyIndex(yaw.keys, atSeconds);
  return index >= 0 && yaw.keys[index]!.aimSpace === "angles";
}

/** Sample every camera channel at one instant and assemble the frame. */
export function sampleCameraFrame(
  store: CameraChannelStore,
  atSeconds: number
): DirectorCameraFrame {
  const read = (id: CameraChannelId, fallback: number) =>
    sampleStoreChannel(store, id, atSeconds, fallback);
  const fallback = DEFAULT_CAMERA_FRAME;
  const position: [number, number, number] = [
    read("camera.position.x", fallback.position[0]),
    read("camera.position.y", fallback.position[1]),
    read("camera.position.z", fallback.position[2]),
  ];

  // A turn in place derives its aim point from the direction it is sweeping
  // through. Reading the target channels here instead would chord across the
  // arc: the framing distance would dip in the middle of the move and the
  // angular rate would not match the turn the director asked for.
  let target: [number, number, number];
  if (aimsByAngle(store, atSeconds)) {
    const yaw = (read("camera.aim.yaw", 0) * Math.PI) / 180;
    const pitch = (read("camera.aim.pitch", 0) * Math.PI) / 180;
    const distance = read("camera.aim.distance", 0);
    const horizontal = Math.cos(pitch) * distance;
    target = [
      position[0] + Math.sin(yaw) * horizontal,
      position[1] + Math.sin(pitch) * distance,
      position[2] + Math.cos(yaw) * horizontal,
    ];
  } else {
    target = [
      read("camera.target.x", fallback.target[0]),
      read("camera.target.y", fallback.target[1]),
      read("camera.target.z", fallback.target[2]),
    ];
  }

  return {
    position,
    target,
    fovDeg: read("camera.lens.fov", fallback.fovDeg),
    rollDeg: read("camera.roll", fallback.rollDeg),
  };
}
