import {
  sampleDirectorBlockingTrack,
  type DirectorBlockingFrame,
} from "./director-blocking-track";
import {
  sampleDirectorCameraTrack,
  type DirectorCameraFrame,
} from "./director-camera-track";
import type {
  ResolvedDirectorCameraChannel,
  ResolvedDirectorScene,
  ResolvedFilmDirectorSpec,
} from "./film-director-schema";

/**
 * A manual layer standing in for one scene's own, for the length of a drag.
 *
 * Committing a hand-keyed value to the document re-resolves the whole film,
 * which is right on release and far too heavy per pointer move. The channel
 * editor hands the whole replacement layer here instead, so the rig answers
 * the drag on the frame the finger moved and the document is written once, at
 * the end.
 */
export interface FilmDirectorChannelPreview {
  sceneId: string;
  channels: readonly ResolvedDirectorCameraChannel[];
}

export interface FilmDirectorFrame {
  filmTimeSeconds: number;
  filmProgress: number;
  sceneIndex: number;
  scene: ResolvedDirectorScene;
  sceneTimeSeconds: number;
  sceneProgress: number;
  sequenceStep: number;
  performerStepOffsets: number[];
  /** Where each performer stands and how they travel, in cast order. */
  performerMotion: DirectorBlockingFrame[];
  camera: ReturnType<typeof sampleDirectorCameraTrack>;
  fadeOpacity: number;
}

export function normalizeFilmTime(
  film: ResolvedFilmDirectorSpec,
  requestedSeconds: number
): number {
  if (!Number.isFinite(requestedSeconds) || film.durationSeconds <= 0) return 0;
  if (film.playback.loop) {
    return (
      ((requestedSeconds % film.durationSeconds) + film.durationSeconds) %
      film.durationSeconds
    );
  }
  return Math.max(0, Math.min(film.durationSeconds, requestedSeconds));
}

function fadeOpacity(
  film: ResolvedFilmDirectorSpec,
  sceneIndex: number,
  sceneTimeSeconds: number
): number {
  const scene = film.scenes[sceneIndex]!;
  const incoming = scene.transition;
  if (incoming.kind === "fade-through-black" && incoming.durationSeconds > 0) {
    const half = incoming.durationSeconds / 2;
    if (sceneTimeSeconds < half) return Math.max(0, 1 - sceneTimeSeconds / half);
  }

  const next =
    film.scenes[sceneIndex + 1] ?? (film.playback.loop ? film.scenes[0] : null);
  if (!next || next.transition.kind !== "fade-through-black") return 0;
  const half = next.transition.durationSeconds / 2;
  if (half <= 0) return 0;
  const remaining = scene.durationSeconds - sceneTimeSeconds;
  return remaining < half ? Math.max(0, 1 - remaining / half) : 0;
}

/**
 * Gap 3. The compiler framed the tracked performer at their opening mark; this
 * shifts that framing by wherever they have walked since. Aim moves only the
 * target, so the camera turns in place; follow moves target and position
 * together, so the framing travels with them. Displacement is measured from
 * the performer's resolved opening position rather than the first blocking
 * keyframe, so a scene whose blocking opens on a hold still tracks.
 */
export function applyCameraTracking(
  camera: DirectorCameraFrame,
  scene: ResolvedDirectorScene,
  performerMotion: readonly DirectorBlockingFrame[]
): DirectorCameraFrame {
  const tracking = scene.camera.tracking;
  if (!tracking) return camera;

  const index = scene.performance.performers.findIndex(
    (performer) => performer.id === tracking.performerId
  );
  const performer = scene.performance.performers[index];
  const motion = performerMotion[index];
  if (!performer || !motion) return camera;

  const dx = motion.position.x - performer.position.x;
  const dz = motion.position.z - performer.position.z;
  if (dx === 0 && dz === 0) return camera;

  const target: [number, number, number] = [
    camera.target[0] + dx,
    camera.target[1],
    camera.target[2] + dz,
  ];
  if (tracking.mode === "aim") return { ...camera, target };
  return {
    ...camera,
    target,
    position: [
      camera.position[0] + dx,
      camera.position[1],
      camera.position[2] + dz,
    ],
  };
}

/**
 * Three incommensurate rates, in cycles per second. Their sum never repeats
 * over a scene's length, so the drift reads as a person holding a rig rather
 * than as a loop.
 */
const HANDHELD_RATES = [0.29, 0.71, 1.63] as const;

/**
 * One noise phase, fixed by the scene's handheld seed and which of the six
 * (axis, rate) slots it belongs to. Arithmetic rather than a hash stream so a
 * frame costs nothing to sample and never depends on sampling order.
 */
function handheldPhase(seed: number, slot: number): number {
  const mixed = Math.imul((seed ^ (slot + 1)) >>> 0, 2654435761) >>> 0;
  return ((mixed % 100003) / 100003) * Math.PI * 2;
}

/** Smooth drift on one axis, always inside [-1, 1]. */
function handheldNoise(seed: number, axis: number, seconds: number): number {
  let sum = 0;
  for (let rate = 0; rate < HANDHELD_RATES.length; rate += 1) {
    const slot = axis * HANDHELD_RATES.length + rate;
    sum += Math.sin(
      2 * Math.PI * HANDHELD_RATES[rate]! * seconds + handheldPhase(seed, slot)
    );
  }
  return sum / HANDHELD_RATES.length;
}

/**
 * Gap 11. Take it off the tripod. The compiled track is what the rig would do
 * on sticks; this adds the operator. Position drifts inside a metres envelope
 * and the aim drifts inside a degrees envelope, converted to metres at the
 * current shooting distance so a long lens shakes as much on screen as a wide
 * one does. Applied after tracking, so following a walker still follows them.
 */
export function applyHandheld(
  camera: DirectorCameraFrame,
  scene: ResolvedDirectorScene,
  sceneTimeSeconds: number
): DirectorCameraFrame {
  const handheld = scene.camera.handheld;
  if (!handheld) return camera;

  const distance = Math.hypot(
    camera.position[0] - camera.target[0],
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2]
  );
  const aimMeters = distance * Math.tan((handheld.degrees * Math.PI) / 180);
  const drift = (axis: number): number =>
    handheldNoise(handheld.seed, axis, sceneTimeSeconds);

  const position: [number, number, number] = [0, 1, 2].map(
    (axis) => camera.position[axis]! + handheld.meters * drift(axis)
  ) as [number, number, number];
  return {
    ...camera,
    position,
    target: [0, 1, 2].map(
      (axis) =>
        camera.target[axis]! + position[axis]! - camera.position[axis]! +
        aimMeters * drift(axis + 3)
    ) as [number, number, number],
  };
}

export function sampleFilmDirector(
  film: ResolvedFilmDirectorSpec,
  requestedSeconds: number,
  channelPreview?: FilmDirectorChannelPreview | null
): FilmDirectorFrame {
  const filmTimeSeconds = normalizeFilmTime(film, requestedSeconds);
  let sceneIndex = film.scenes.findIndex(
    (scene) =>
      filmTimeSeconds >= scene.startSeconds &&
      filmTimeSeconds < scene.startSeconds + scene.durationSeconds
  );
  if (sceneIndex < 0) sceneIndex = film.scenes.length - 1;

  const scene = film.scenes[sceneIndex]!;
  const sceneTimeSeconds = Math.max(
    0,
    Math.min(scene.durationSeconds, filmTimeSeconds - scene.startSeconds)
  );

  const performerMotion = scene.performance.performers.map((performer) =>
    sampleDirectorBlockingTrack(performer.blocking, sceneTimeSeconds)
  );
  const camera = applyHandheld(
    applyCameraTracking(
      sampleDirectorCameraTrack(
        scene.camera.keyframes,
        sceneTimeSeconds,
        channelPreview?.sceneId === scene.id
          ? channelPreview.channels
          : scene.camera.channels
      ),
      scene,
      performerMotion
    ),
    scene,
    sceneTimeSeconds
  );

  return {
    filmTimeSeconds,
    filmProgress:
      film.durationSeconds > 0 ? filmTimeSeconds / film.durationSeconds : 0,
    sceneIndex,
    scene,
    sceneTimeSeconds,
    sceneProgress: sceneTimeSeconds / scene.durationSeconds,
    // Gap 16. stepOffset is the count this scene opened on: zero when the
    // scene restarts the phrase, the previous scene's final count when it
    // continues.
    sequenceStep:
      (scene.performance.stepOffset ?? 0) +
      (sceneTimeSeconds * scene.performance.bpm) / 60,
    performerStepOffsets: scene.performance.performers.map(
      (performer) => performer.beatOffset
    ),
    performerMotion,
    camera,
    fadeOpacity: fadeOpacity(film, sceneIndex, sceneTimeSeconds),
  };
}
