import { cameraCorrectionsFor } from "./camera-corrections";
import {
  sampleDirectorBlockingTrack,
  type DirectorBlockingFrame,
} from "./director-blocking-track";
import { sampleDirectorCamera } from "./director-camera-track";
import type { CameraCorrection } from "./director-camera-channels";
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
  camera: ReturnType<typeof sampleDirectorCamera>;
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
 * One scene's corrections, built once and reused.
 *
 * The store caches on the corrections array's identity, so handing it a fresh
 * array every frame would rebuild eleven channels every frame. Corrections are
 * a pure function of the resolved scene, so the scene is the cache key.
 */
const SCENE_CORRECTIONS = new WeakMap<
  ResolvedDirectorScene,
  readonly CameraCorrection[]
>();

function correctionsFor(
  scene: ResolvedDirectorScene
): readonly CameraCorrection[] | undefined {
  let corrections = SCENE_CORRECTIONS.get(scene);
  if (!corrections) {
    corrections = cameraCorrectionsFor(scene);
    SCENE_CORRECTIONS.set(scene, corrections);
  }
  return corrections.length ? corrections : undefined;
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
  const manual =
    channelPreview?.sceneId === scene.id
      ? channelPreview.channels
      : scene.camera.channels;
  const corrections = correctionsFor(scene);
  const camera = sampleDirectorCamera(scene.camera, sceneTimeSeconds, {
    ...(manual ? { manual } : {}),
    ...(corrections ? { corrections } : {}),
  });

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
