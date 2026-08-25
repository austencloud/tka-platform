import { ZodError } from "zod";

import { sampleFilmDirector } from "./sample-film-director";
import { resolveFilmDirectorSpec } from "./resolve-film-director-spec";
import { applyPerformerEdit, type PerformerEdit } from "./film-director-edit";
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
    sceneIndex: 0,
    totalScenes: film.scenes.length,
    sceneTitle: film.scenes[0]?.title ?? "Opening scene",
    preparedSteps: 0,
    totalSteps: getFilmDirectorWarmupStepCount(film.scenes.length),
  });
  let editorOpen = $state(false);
  let validationError = $state<string | null>(null);
  /**
   * Bumped by every in-place document edit. A control-surface edit replaces
   * the film with a re-resolved copy while the same scene stays on screen, so
   * the scene's own cut detection — which compares scene ids — cannot see it.
   */
  let editRevision = $state(0);
  let lastEditError = $state<string | null>(null);
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

  function setPreparationScene(index: number, preparedSteps = 0): void {
    const scene = film.scenes[index];
    if (!scene) return;
    preparation = {
      complete: false,
      sceneIndex: index,
      totalScenes: film.scenes.length,
      sceneTitle: scene.title,
      preparedSteps: Math.max(
        0,
        Math.min(
          getFilmDirectorWarmupStepCount(film.scenes.length),
          preparedSteps
        )
      ),
      totalSteps: getFilmDirectorWarmupStepCount(film.scenes.length),
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
      sceneIndex: 0,
      totalScenes: film.scenes.length,
      sceneTitle: film.scenes[0]?.title ?? "Opening scene",
      preparedSteps: 0,
      totalSteps: getFilmDirectorWarmupStepCount(film.scenes.length),
    };
  }

  function selectScene(index: number): void {
    const scene = film.scenes[index];
    if (!scene) return;
    const clearPreviewOffset =
      scene.transition.kind === "fade-through-black"
        ? scene.transition.durationSeconds / 2 + 0.001
        : 0.001;
    seek(scene.startSeconds + clearPreviewOffset);
  }

  function previousScene(): void {
    selectScene(
      frame.sceneIndex > 0 ? frame.sceneIndex - 1 : film.scenes.length - 1
    );
  }

  function nextScene(): void {
    selectScene((frame.sceneIndex + 1) % film.scenes.length);
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

  /**
   * Patches one performer in the authored document and re-resolves.
   *
   * Unlike `applyDraft`, the playhead and the warmup are left alone: the same
   * scene is still on screen and only its cast's parameters moved. Returns
   * false and leaves the document untouched when the edit would not validate.
   */
  function editPerformer(edit: PerformerEdit): boolean {
    try {
      // $state.snapshot first: sourceInput is a reactive proxy, and
      // structuredClone throws on one.
      const patched = applyPerformerEdit(
        $state.snapshot(sourceInput) as FilmDirectorInput,
        film,
        edit
      );
      const nextFilm = resolveFilmDirectorSpec(patched);
      sourceInput = patched;
      film = nextFilm;
      draft = JSON.stringify(patched, null, 2);
      lastEditError = null;
      editRevision += 1;
      return true;
    } catch (error: unknown) {
      lastEditError = explainValidationError(error);
      return false;
    }
  }

  function loadFilm(input: FilmDirectorInput): boolean {
    try {
      const cloned = structuredClone(input);
      const nextFilm = resolveFilmDirectorSpec(cloned);
      sourceInput = cloned;
      film = nextFilm;
      draft = JSON.stringify(cloned, null, 2);
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

  // The WebGL canvas belongs to the scene, which is a child of the workbench,
  // so context cannot carry it upward. The scene registers a getter here and
  // the workbench reads it when the user saves a poster.
  let posterSource: (() => HTMLCanvasElement | null) | null = null;

  function setPosterSource(getter: (() => HTMLCanvasElement | null) | null): void {
    posterSource = getter;
  }

  function readPosterSource(): HTMLCanvasElement | null {
    return posterSource?.() ?? null;
  }

  return {
    get film() {
      return film;
    },
    /** The authored document, which is what gets saved — not the resolved spec. */
    get sourceInput() {
      return sourceInput;
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
    get editRevision() {
      return editRevision;
    },
    get lastEditError() {
      return lastEditError;
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
    setPreparationScene,
    completePreparation,
    selectScene,
    previousScene,
    nextScene,
    setDraft,
    applyDraft,
    resetDraft,
    editPerformer,
    loadFilm,
    toggleEditor,
    setPosterSource,
    readPosterSource,
    start,
    destroy,
  };
}

export type FilmDirectorState = ReturnType<typeof createFilmDirectorState>;
