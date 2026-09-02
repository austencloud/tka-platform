import {
  sampleDirectorBlockingTrack,
  type DirectorBlockingFrame,
} from "./director-blocking-track";
import {
  sampleDirectorCameraTrack,
  type DirectorCameraFrame,
} from "./director-camera-track";
import type {
  ResolvedDirectorScene,
  ResolvedFilmDirectorSpec,
} from "./film-director-schema";

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

export function sampleFilmDirector(
  film: ResolvedFilmDirectorSpec,
  requestedSeconds: number
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
  const camera = applyCameraTracking(
    sampleDirectorCameraTrack(scene.camera.keyframes, sceneTimeSeconds),
    scene,
    performerMotion
  );

  return {
    filmTimeSeconds,
    filmProgress:
      film.durationSeconds > 0 ? filmTimeSeconds / film.durationSeconds : 0,
    sceneIndex,
    scene,
    sceneTimeSeconds,
    sceneProgress: sceneTimeSeconds / scene.durationSeconds,
    sequenceStep: (sceneTimeSeconds * scene.performance.bpm) / 60,
    performerStepOffsets: scene.performance.performers.map(
      (performer) => performer.beatOffset
    ),
    performerMotion,
    camera,
    fadeOpacity: fadeOpacity(film, sceneIndex, sceneTimeSeconds),
  };
}
