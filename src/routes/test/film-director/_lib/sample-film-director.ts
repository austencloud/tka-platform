import { sampleDirectorCameraTrack } from "./director-camera-track";
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
    camera: sampleDirectorCameraTrack(scene.camera.keyframes, sceneTimeSeconds),
    fadeOpacity: fadeOpacity(film, sceneIndex, sceneTimeSeconds),
  };
}
