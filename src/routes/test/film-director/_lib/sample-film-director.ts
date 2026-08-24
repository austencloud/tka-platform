import { sampleDirectorCameraTrack } from "./director-camera-track";
import type {
  ResolvedDirectorShot,
  ResolvedFilmDirectorSpec,
} from "./film-director-schema";

export interface FilmDirectorFrame {
  filmTimeSeconds: number;
  filmProgress: number;
  shotIndex: number;
  shot: ResolvedDirectorShot;
  shotTimeSeconds: number;
  shotProgress: number;
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
  shotIndex: number,
  shotTimeSeconds: number
): number {
  const shot = film.shots[shotIndex]!;
  const incoming = shot.transition;
  if (incoming.kind === "fade-through-black" && incoming.durationSeconds > 0) {
    const half = incoming.durationSeconds / 2;
    if (shotTimeSeconds < half) return Math.max(0, 1 - shotTimeSeconds / half);
  }

  const next =
    film.shots[shotIndex + 1] ?? (film.playback.loop ? film.shots[0] : null);
  if (!next || next.transition.kind !== "fade-through-black") return 0;
  const half = next.transition.durationSeconds / 2;
  if (half <= 0) return 0;
  const remaining = shot.durationSeconds - shotTimeSeconds;
  return remaining < half ? Math.max(0, 1 - remaining / half) : 0;
}

export function sampleFilmDirector(
  film: ResolvedFilmDirectorSpec,
  requestedSeconds: number
): FilmDirectorFrame {
  const filmTimeSeconds = normalizeFilmTime(film, requestedSeconds);
  let shotIndex = film.shots.findIndex(
    (shot) =>
      filmTimeSeconds >= shot.startSeconds &&
      filmTimeSeconds < shot.startSeconds + shot.durationSeconds
  );
  if (shotIndex < 0) shotIndex = film.shots.length - 1;

  const shot = film.shots[shotIndex]!;
  const shotTimeSeconds = Math.max(
    0,
    Math.min(shot.durationSeconds, filmTimeSeconds - shot.startSeconds)
  );

  return {
    filmTimeSeconds,
    filmProgress:
      film.durationSeconds > 0 ? filmTimeSeconds / film.durationSeconds : 0,
    shotIndex,
    shot,
    shotTimeSeconds,
    shotProgress: shotTimeSeconds / shot.durationSeconds,
    sequenceStep: (shotTimeSeconds * shot.performance.bpm) / 60,
    performerStepOffsets: shot.performance.performers.map(
      (performer) => performer.beatOffset
    ),
    camera: sampleDirectorCameraTrack(shot.camera.keyframes, shotTimeSeconds),
    fadeOpacity: fadeOpacity(film, shotIndex, shotTimeSeconds),
  };
}
