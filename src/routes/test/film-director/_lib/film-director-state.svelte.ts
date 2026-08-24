import { ZodError } from "zod";

import { sampleFilmDirector } from "./sample-film-director";
import { resolveFilmDirectorSpec } from "./resolve-film-director-spec";
import type { FilmDirectorInput } from "./film-director-schema";
import { getFilmDirectorWarmupStepCount } from "./film-director-warmup-plan";

function explainValidationError(error: unknown): string {
  if (!(error instanceof ZodError)) {
    return error instanceof Error ? error.message : String(error);
  }

  const issues = error.issues.slice(0, 3).map((issue) => {
    const field = issue.path.length
      ? issue.path
          .map((part) => (typeof part === "number" ? part + 1 : part))
          .join(" → ")
      : "film";
    const message = issue.message
      .replace("Invalid input: expected 1", "must be 1")
      .replace(
        /Invalid input: expected \w+, received undefined/,
        "is required"
      );
    return `${field} ${message}`;
  });
  const remaining = error.issues.length - issues.length;
  return `${issues.join(". ")}${remaining > 0 ? `. ${remaining} more issue${remaining === 1 ? "" : "s"}.` : "."}`;
}

export function createFilmDirectorState(initialInput: FilmDirectorInput) {
  let sourceInput = $state<FilmDirectorInput>(structuredClone(initialInput));
  let film = $state(resolveFilmDirectorSpec(sourceInput));
  let draft = $state(JSON.stringify(sourceInput, null, 2));
  let playheadSeconds = $state(0);
  let wantsToPlay = $state(film.playback.autoplay);
  let isPlaying = $state(false);
  let sceneReady = $state(false);
  let transitionHolding = $state(false);
  let preparationRevision = $state(0);
  let preparation = $state({
    complete: false,
    shotIndex: 0,
    totalShots: film.shots.length,
    shotTitle: film.shots[0]?.title ?? "Opening shot",
    preparedSteps: 0,
    totalSteps: getFilmDirectorWarmupStepCount(film.shots.length),
  });
  let editorOpen = $state(false);
  let validationError = $state<string | null>(null);
  let frameRequest: number | null = null;
  let lastFrameTime: number | null = null;

  const frame = $derived(sampleFilmDirector(film, playheadSeconds));

  function seek(seconds: number): void {
    if (film.playback.loop) {
      playheadSeconds =
        ((seconds % film.durationSeconds) + film.durationSeconds) %
        film.durationSeconds;
      return;
    }
    playheadSeconds = Math.max(0, Math.min(film.durationSeconds, seconds));
  }

  function play(): void {
    wantsToPlay = true;
    if (!film.playback.loop && playheadSeconds >= film.durationSeconds) seek(0);
    if (sceneReady && !transitionHolding) isPlaying = true;
  }

  function pause(): void {
    wantsToPlay = false;
    isPlaying = false;
  }

  function togglePlayback(): void {
    if (wantsToPlay) pause();
    else play();
  }

  function setSceneReady(ready: boolean): void {
    sceneReady = ready;
    isPlaying = ready && wantsToPlay && !transitionHolding;
  }

  function setTransitionHolding(holding: boolean): void {
    transitionHolding = holding;
    isPlaying = sceneReady && wantsToPlay && !holding;
  }

  function setPreparationShot(index: number, preparedSteps = 0): void {
    const shot = film.shots[index];
    if (!shot) return;
    preparation = {
      complete: false,
      shotIndex: index,
      totalShots: film.shots.length,
      shotTitle: shot.title,
      preparedSteps: Math.max(
        0,
        Math.min(
          getFilmDirectorWarmupStepCount(film.shots.length),
          preparedSteps
        )
      ),
      totalSteps: getFilmDirectorWarmupStepCount(film.shots.length),
    };
  }

  function completePreparation(): void {
    preparation = { ...preparation, complete: true };
  }

  function resetPreparation(): void {
    sceneReady = false;
    transitionHolding = false;
    isPlaying = false;
    preparationRevision += 1;
    preparation = {
      complete: false,
      shotIndex: 0,
      totalShots: film.shots.length,
      shotTitle: film.shots[0]?.title ?? "Opening shot",
      preparedSteps: 0,
      totalSteps: getFilmDirectorWarmupStepCount(film.shots.length),
    };
  }

  function selectShot(index: number): void {
    const shot = film.shots[index];
    if (!shot) return;
    const clearPreviewOffset =
      shot.transition.kind === "fade-through-black"
        ? shot.transition.durationSeconds / 2 + 0.001
        : 0.001;
    seek(shot.startSeconds + clearPreviewOffset);
  }

  function previousShot(): void {
    selectShot(
      frame.shotIndex > 0 ? frame.shotIndex - 1 : film.shots.length - 1
    );
  }

  function nextShot(): void {
    selectShot((frame.shotIndex + 1) % film.shots.length);
  }

  function setDraft(value: string): void {
    draft = value;
    validationError = null;
  }

  function applyDraft(): boolean {
    try {
      const parsed = JSON.parse(draft) as unknown;
      const nextFilm = resolveFilmDirectorSpec(parsed);
      sourceInput = parsed as FilmDirectorInput;
      film = nextFilm;
      playheadSeconds = 0;
      wantsToPlay = nextFilm.playback.autoplay;
      isPlaying = sceneReady && wantsToPlay && !transitionHolding;
      validationError = null;
      resetPreparation();
      return true;
    } catch (error: unknown) {
      validationError = explainValidationError(error);
      return false;
    }
  }

  function resetDraft(): void {
    draft = JSON.stringify(sourceInput, null, 2);
    validationError = null;
  }

  function toggleEditor(): void {
    editorOpen = !editorOpen;
  }

  function tick(timestamp: number): void {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const deltaSeconds = Math.min(
      0.1,
      Math.max(0, (timestamp - lastFrameTime) / 1000)
    );
    lastFrameTime = timestamp;

    if (isPlaying) {
      const next = playheadSeconds + deltaSeconds;
      if (!film.playback.loop && next >= film.durationSeconds) {
        playheadSeconds = film.durationSeconds;
        isPlaying = false;
        wantsToPlay = false;
      } else {
        seek(next);
      }
    }
    frameRequest = requestAnimationFrame(tick);
  }

  function start(): void {
    if (frameRequest !== null) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) wantsToPlay = false;
    lastFrameTime = null;
    frameRequest = requestAnimationFrame(tick);
  }

  function destroy(): void {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }

  return {
    get film() {
      return film;
    },
    get draft() {
      return draft;
    },
    get playheadSeconds() {
      return playheadSeconds;
    },
    get wantsToPlay() {
      return wantsToPlay;
    },
    get isPlaying() {
      return isPlaying;
    },
    get sceneReady() {
      return sceneReady;
    },
    get transitionHolding() {
      return transitionHolding;
    },
    get preparation() {
      return preparation;
    },
    get preparationRevision() {
      return preparationRevision;
    },
    get editorOpen() {
      return editorOpen;
    },
    get validationError() {
      return validationError;
    },
    get frame() {
      return frame;
    },
    seek,
    play,
    pause,
    togglePlayback,
    setSceneReady,
    setTransitionHolding,
    setPreparationShot,
    completePreparation,
    selectShot,
    previousShot,
    nextShot,
    setDraft,
    applyDraft,
    resetDraft,
    toggleEditor,
    start,
    destroy,
  };
}

export type FilmDirectorState = ReturnType<typeof createFilmDirectorState>;
