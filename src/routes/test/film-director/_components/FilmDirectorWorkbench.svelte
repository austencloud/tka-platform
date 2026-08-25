<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import { replaceState } from "$app/navigation";
  import SaveFilmModal from "$lib/features/film-collection/components/SaveFilmModal.svelte";
  import type {
    CollectedFilm,
    StoredFilmDocument,
  } from "$lib/features/film-collection/domain/film-collection-types";
  import { captureFilmPoster } from "$lib/features/film-collection/services/capture-film-poster";
  import { filmCollectionState } from "$lib/features/film-collection/state/film-collection-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { setFilmDirectorContext } from "../_lib/film-director-context";
  import { createFilmDirectorState } from "../_lib/film-director-state.svelte";
  import type { FilmDirectorInput } from "../_lib/film-director-schema";
  import {
    filmOriginIsSaved,
    filmOriginUrlKey,
    type FilmOrigin,
  } from "../_lib/film-origin";
  import FilmDirectorFilmPanel from "./FilmDirectorFilmPanel.svelte";
  import FilmDirectorJsonEditor from "./FilmDirectorJsonEditor.svelte";
  import FilmDirectorScene from "./FilmDirectorScene.svelte";
  import FilmDirectorTransport from "./FilmDirectorTransport.svelte";

  let {
    film,
    initialOrigin,
    onExit,
  }: {
    film: FilmDirectorInput;
    initialOrigin: FilmOrigin;
    /** Back to the marquee. The route owns which surface is showing. */
    onExit: () => void;
  } = $props();

  const director = createFilmDirectorState(film);
  setFilmDirectorContext(director);

  // The scene's performer bar pins itself to the stage's top-left corner,
  // which is exactly where the back-to-Films button sits. Publish how far in
  // the button reaches so the bar can start clear of it rather than render
  // underneath — same arrangement the transport uses for the rail below.
  let workbenchEl = $state<HTMLElement | null>(null);
  let exitButtonEl = $state<HTMLElement | null>(null);
  let exitButtonWidth = $state(0);
  $effect(() => {
    void exitButtonWidth;
    if (!workbenchEl || !exitButtonEl) return;
    workbenchEl.style.setProperty(
      "--director-exit-reserve",
      `${exitButtonEl.offsetLeft + exitButtonEl.offsetWidth}px`
    );
  });

  let origin = $state<FilmOrigin>(initialOrigin);
  let saveOpen = $state(false);
  let poster = $state("");

  // Takes the origin rather than a bare key so the URL can never disagree with
  // what Save will do.
  function syncFilmToUrl(next: FilmOrigin): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("film", filmOriginUrlKey(next));
    replaceState(url, {});
  }

  function openSaveModal(): void {
    // Capture before the modal paints over the canvas, so the poster is the
    // frame the user was actually looking at.
    poster = captureFilmPoster(director.readPosterSource());
    saveOpen = true;
  }

  function handleSaved(id: string): void {
    const entry = filmCollectionState.collection.find((item) => item.id === id);
    origin = { kind: "saved", id, name: entry?.name ?? director.film.title };
    syncFilmToUrl(origin);
  }

  let saveBusy = $state(false);
  const previousVersionAvailable = $derived(
    Boolean(currentEntry()?.previousFilm)
  );

  /**
   * The saved entry the stage is editing, or null when the film has never been
   * saved. Reads `origin` into a const first: TypeScript drops the narrowing
   * from `filmOriginIsSaved` inside a callback that captures a mutable `let`.
   */
  function currentEntry(): CollectedFilm | null {
    const current = origin;
    if (!filmOriginIsSaved(current)) return null;
    return (
      filmCollectionState.collection.find((entry) => entry.id === current.id) ??
      null
    );
  }

  /** The fields an overwrite replaces. Identity — id, name, createdAt — is
   *  exactly what it preserves, so a link to this entry survives an edit. */
  function currentFilmPatch() {
    return {
      film: $state.snapshot(director.sourceInput) as unknown as StoredFilmDocument,
      poster: captureFilmPoster(director.readPosterSource()),
      durationSeconds: director.film.durationSeconds,
      sceneCount: director.film.scenes.length,
    };
  }

  async function saveFilm(): Promise<void> {
    const entry = currentEntry();
    if (!entry) {
      openSaveModal();
      return;
    }
    if (saveBusy) return;
    saveBusy = true;
    try {
      // previousFilm is always a real document here. Never pass it as
      // undefined: update() spreads the patch, and Firestore rejects an
      // explicit undefined field.
      await filmCollectionState.update(entry.id, {
        ...currentFilmPatch(),
        previousFilm: $state.snapshot(entry.film),
      });
      toast.success("Film saved");
    } catch (error) {
      console.warn("[Director] Overwrite failed:", error);
      toast.error("Couldn't save the film");
    } finally {
      saveBusy = false;
    }
  }

  async function restorePreviousFilm(): Promise<void> {
    if (saveBusy) return;
    const entry = currentEntry();
    const restored = entry?.previousFilm;
    if (!entry || !restored) return;
    saveBusy = true;
    try {
      // Swap rather than drop, so Restore is itself undoable.
      const document = $state.snapshot(restored) as unknown as StoredFilmDocument;
      await filmCollectionState.update(entry.id, {
        film: document,
        previousFilm: $state.snapshot(entry.film),
      });
      director.loadFilm(document as unknown as FilmDirectorInput);
      toast.success("Previous version restored");
    } catch (error) {
      console.warn("[Director] Restore failed:", error);
      toast.error("Couldn't restore that version");
    } finally {
      saveBusy = false;
    }
  }

  onMount(() => {
    // The URL always names what is on screen, including when the address bar
    // arrived bare and the route picked the film.
    syncFilmToUrl(origin);
    // Drive seam for scripts/build-film-posters.mjs, which has to seek to a
    // scene-relative cue and read the canvas back over CDP. Dev only.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__filmDirector = director;
    }
    return director.start();
  });
  onDestroy(() => director.destroy());
</script>

<main
  class="director-workbench"
  data-film-director-workbench
  bind:this={workbenchEl}
>
  <FilmDirectorScene />

  {#if !director.preparation.complete}
    <div class="film-preparation" role="status" aria-live="polite">
      <div class="preparation-card">
        <span class="preparation-kicker">Preparing the film</span>
        <strong>{director.preparation.sceneTitle}</strong>
        <span class="preparation-count">
          Scene {director.preparation.sceneIndex + 1} of {director.preparation
            .totalScenes}
        </span>
        <div class="preparation-track" aria-hidden="true">
          <span
            style:width={`${(director.preparation.preparedSteps / director.preparation.totalSteps) * 100}%`}
          ></span>
        </div>
      </div>
    </div>
  {/if}

  <button
    type="button"
    class="exit-button"
    onclick={onExit}
    bind:this={exitButtonEl}
    bind:clientWidth={exitButtonWidth}
  >
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Films
  </button>

  {#if director.lastEditError}
    <div class="edit-error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      {director.lastEditError}
    </div>
  {/if}

  <FilmDirectorTransport>
    {#snippet trailing()}
      <FilmDirectorFilmPanel
        {origin}
        hasPreviousVersion={previousVersionAvailable}
        busy={saveBusy}
        onSave={saveFilm}
        onSaveAsNew={openSaveModal}
        onRestore={restorePreviousFilm}
      />
    {/snippet}
  </FilmDirectorTransport>
  <FilmDirectorJsonEditor />
</main>

<SaveFilmModal
  bind:open={saveOpen}
  film={director.sourceInput}
  {poster}
  durationSeconds={director.film.durationSeconds}
  sceneCount={director.film.scenes.length}
  onsaved={handleSaved}
/>

<style>
  @media (min-width: 1680px) {
    :global(html:has([data-film-director-workbench])) {
      font-size: clamp(1rem, 0.61rem + 0.37vw, 1.5rem);
    }
  }

  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #070812;
  }

  .director-workbench {
    position: fixed;
    inset: 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    background: #070812;
    container-type: size;
  }

  .film-preparation {
    position: absolute;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    padding: 1rem;
    background:
      radial-gradient(
        circle at 50% 42%,
        rgba(157, 140, 255, 0.12),
        transparent 34rem
      ),
      #070812;
  }

  .preparation-card {
    display: grid;
    width: min(28rem, calc(100vw - 2rem));
    gap: 0.55rem;
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: var(--theme-panel-bg, #10111b);
    box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.45);
  }

  .preparation-kicker {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .preparation-card strong {
    font-size: clamp(1.1rem, 3cqi, 1.45rem);
  }

  .preparation-count {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .preparation-track {
    height: 0.3rem;
    margin-top: 0.35rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .preparation-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--theme-accent, #9d8cff);
    transition: width 180ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .preparation-track span {
      transition: none;
    }
  }

  .exit-button {
    position: absolute;
    top: max(0.85rem, env(safe-area-inset-top));
    left: max(0.85rem, env(safe-area-inset-left));
    z-index: 65;
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.7rem;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 88%,
      transparent
    );
    box-shadow: 0 0.8rem 2.5rem rgba(0, 0, 0, 0.3);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    cursor: pointer;
  }

  .exit-button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .exit-button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  /* Below the exit button and clear of the right rail: the top band holds one
     control now, so the message needs no breakpoint to find room. It is the
     highest-priority thing on screen while it is up, and it clears on the next
     accepted edit. */
  .edit-error {
    position: absolute;
    top: calc(max(0.85rem, env(safe-area-inset-top)) + 3.6rem);
    right: max(4.75rem, calc(env(safe-area-inset-right) + 4.75rem));
    left: max(0.85rem, env(safe-area-inset-left));
    z-index: 72;
    display: flex;
    gap: 0.55rem;
    align-items: center;
    padding: 0.65rem 0.9rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-danger, #ff6b6b) 55%, transparent);
    border-radius: 0.7rem;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--semantic-danger, #ff6b6b) 22%,
      var(--theme-panel-bg, #10111b)
    );
    box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.42);
    font-size: var(--font-size-min, 0.875rem);
  }

  .edit-error i {
    color: var(--semantic-danger, #ff6b6b);
  }

  @media (min-width: 64rem) {
    .edit-error {
      max-width: 34rem;
    }
  }
</style>
