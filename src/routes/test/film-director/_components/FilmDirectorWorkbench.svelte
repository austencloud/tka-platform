<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import SaveFilmModal from "$lib/features/film-collection/components/SaveFilmModal.svelte";
  import type {
    CollectedFilm,
    StoredFilmDocument,
  } from "$lib/features/film-collection/domain/film-collection-types";
  import { captureFilmPoster } from "$lib/features/film-collection/services/capture-film-poster";
  import { filmCollectionState } from "$lib/features/film-collection/state/film-collection-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    DEFAULT_FILM_KEY,
    FILM_LIBRARY,
    getLibraryFilm,
  } from "../_films/index";
  import { setFilmDirectorContext } from "../_lib/film-director-context";
  import { createFilmDirectorState } from "../_lib/film-director-state.svelte";
  import type { FilmDirectorInput } from "../_lib/film-director-schema";
  import { parseFilmKey } from "../_lib/film-key";
  import {
    filmOriginIsSaved,
    filmOriginUrlKey,
    type FilmOrigin,
  } from "../_lib/film-origin";
  import FilmDirectorFilmPanel from "./FilmDirectorFilmPanel.svelte";
  import FilmDirectorJsonEditor from "./FilmDirectorJsonEditor.svelte";
  import FilmDirectorScene from "./FilmDirectorScene.svelte";
  import FilmDirectorTransport from "./FilmDirectorTransport.svelte";

  // `?film=<key>` boots straight into one film, so a film is a link rather
  // than a click - shareable, bookmarkable, and drivable from a script or a
  // screenshot pass. Read once at construction: the workbench owns the
  // selection from here on and writes the URL back to match.
  const requestedFilm = parseFilmKey(page.url.searchParams.get("film"));
  const initialFilmKey =
    requestedFilm.kind === "library" ? requestedFilm.key : DEFAULT_FILM_KEY;

  const director = createFilmDirectorState(getLibraryFilm(initialFilmKey));
  setFilmDirectorContext(director);

  // A saved film boots to the default library film first, because the
  // collection has to load before its document exists. The saved one replaces
  // it once it arrives.
  let origin = $state<FilmOrigin>({ kind: "library", key: initialFilmKey });
  // The titleplate, the film picker, and the film actions all paint above the
  // performer dock, so the dock has to start below whichever reaches lowest.
  // Their heights move with the film title, with how the picker wraps, and with
  // the narrow layout that drops the actions under the picker, so the band is
  // measured rather than assumed.
  let topLeftEl = $state<HTMLElement | null>(null);
  let topLeftHeight = $state(0);
  $effect(() => {
    void topLeftHeight;
    document.documentElement.style.setProperty(
      "--director-header-reserve",
      `${topLeftEl ? topLeftEl.offsetTop + topLeftEl.offsetHeight : 0}px`
    );
  });
  let saveOpen = $state(false);
  let poster = $state("");

  const FILM_SHORT_LABELS: Record<string, string> = {
    sky: "Sky",
    planes: "Planes",
    understudy: "Night",
    chance: "Chance",
    star: "Star",
  };

  const filmOptions = FILM_LIBRARY.map((entry) => ({
    value: entry.key,
    label: entry.label,
    shortLabel: FILM_SHORT_LABELS[entry.key] ?? entry.label,
  }));

  function selectFilm(key: string): void {
    if (origin.kind === "library" && key === origin.key) return;
    if (!director.loadFilm(getLibraryFilm(key))) return;
    origin = { kind: "library", key };
    syncFilmToUrl(origin);
  }

  // Takes the origin rather than a bare key so the URL can never disagree with
  // what Save will do.
  function syncFilmToUrl(next: FilmOrigin): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("film", filmOriginUrlKey(next));
    replaceState(url, {});
  }

  function openSavedFilm(entry: CollectedFilm): void {
    // The entry is a $state proxy, and loadFilm structuredClones its input,
    // which throws on a proxy and is swallowed by loadFilm's own try/catch.
    // Snapshot to a plain object first.
    const doc = $state.snapshot(entry.film) as unknown as FilmDirectorInput;
    if (!director.loadFilm(doc)) return;
    origin = { kind: "saved", id: entry.id, name: entry.name };
    syncFilmToUrl(origin);
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

  // A `saved:` link resolves as soon as the entry exists. Guests hydrate
  // synchronously in onMount, but a signed-in user's Firestore load lands
  // later, so this waits for the collection rather than deciding once.
  let pendingSavedId = $state<string | null>(
    requestedFilm.kind === "saved" ? requestedFilm.id : null,
  );

  $effect(() => {
    const id = pendingSavedId;
    if (!id || filmCollectionState.loading) return;

    // Hydrate before reading: this effect runs ahead of onMount, and a guest's
    // entries only exist in the store once initLocal has pulled them in. It is
    // idempotent, so calling it here and at mount is safe.
    filmCollectionState.initLocal();

    const entry = filmCollectionState.collection.find((item) => item.id === id);
    pendingSavedId = null;
    // A link to a film the user cannot see leaves the default film on screen
    // rather than an error, with the URL restamped to match what is showing.
    if (entry) openSavedFilm(entry);
    else syncFilmToUrl(origin);
  });

  onMount(() => {
    // Guest sessions hydrate from localStorage; signed-in boot goes through
    // auth-boot-orchestrator's init(uid) instead, and initLocal no-ops then.
    filmCollectionState.initLocal();

    // Stamp the resolved key when the URL arrived bare or with a key the
    // library no longer has, so the address bar always names what is on screen.
    if (requestedFilm.kind === "unknown") syncFilmToUrl(origin);

    return director.start();
  });
  onDestroy(() => director.destroy());
</script>

<main class="director-workbench" data-film-director-workbench>
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

  <div class="top-left" bind:this={topLeftEl} bind:clientHeight={topLeftHeight}>
    <div class="titleplate">
      <span class="film-name">{director.film.title}</span>
      <h1>{director.frame.scene.title}</h1>
      <p>
        Scene {director.frame.sceneIndex + 1} of {director.film.scenes.length}
        <span aria-hidden="true">·</span>
        {director.frame.scene.location.environmentId}
        <span aria-hidden="true">·</span>
        {director.frame.scene.performance.performers.length} performers
        <span aria-hidden="true">·</span>
        {director.frame.scene.performance.bpm} BPM
      </p>
    </div>
    <div class="film-picker themed-scrollbar">
      <div class="film-picker-track">
        <SegmentedControl
          options={filmOptions}
          value={origin.kind === "library" ? origin.key : ""}
          onchange={selectFilm}
          size="sm"
          color="accent"
          ariaLabel="Film"
        />
      </div>
    </div>
  </div>

  <div class="readiness" class:ready={director.sceneReady} role="status">
    <span aria-hidden="true"></span>
    {director.sceneReady ? "Scene ready" : "Building scene"}
  </div>

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

  .top-left {
    position: absolute;
    top: max(0.85rem, env(safe-area-inset-top));
    left: max(0.85rem, env(safe-area-inset-left));
    z-index: 65;
    display: grid;
    justify-items: start;
    gap: 0.55rem;
    max-width: min(38rem, calc(100% - 12rem));
  }

  .film-picker {
    max-width: 100%;
    overflow-x: auto;
    padding: 0.3rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 88%,
      transparent
    );
    box-shadow: 0 0.8rem 2.5rem rgba(0, 0, 0, 0.3);
  }

  .film-picker-track {
    /* SegmentedControl divides its width into equal segments, so the control
       needs room for its widest label times the option count or the longest
       word clips. Sized to the one-word short labels; in rem so it tracks the
       root ramp instead of freezing at 1080p proportions. Below that width the
       parent scrolls rather than the labels shrinking into nothing. */
    min-width: 24rem;
  }

  .titleplate {
    max-width: 100%;
    padding: 0.8rem 1rem;
    border-left: 0.18rem solid var(--theme-accent, #9d8cff);
    border-radius: 0 0.85rem 0.85rem 0;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 88%,
      transparent
    );
    box-shadow: 0 0.8rem 2.5rem rgba(0, 0, 0, 0.3);
  }

  .film-name {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    margin-top: 0.18rem;
    font-size: clamp(1.05rem, 2.2cqi, 1.65rem);
    line-height: 1.15;
  }

  p {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
    margin-top: 0.38rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .readiness {
    position: absolute;
    top: max(0.85rem, env(safe-area-inset-top));
    right: max(0.85rem, env(safe-area-inset-right));
    z-index: 65;
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.85rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 88%,
      transparent
    );
    font-size: var(--font-size-compact, 0.75rem);
  }

  /* Narrow: the dock fills the stage, so a rejected edit takes the header band
     and paints over it. The message is the highest-priority thing on screen
     while it is up, and it clears on the next accepted edit. */
  .edit-error {
    position: absolute;
    top: calc(var(--director-header-reserve, 12rem) + 0.65rem);
    right: max(0.75rem, env(safe-area-inset-right));
    left: max(0.75rem, env(safe-area-inset-left));
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

  /* Wide enough that the dock's own cap leaves a right column free: the message
     moves down beside the transport where it covers nothing. 64rem is the width
     at which a 26rem message clears the dock's 32.5rem floor. */
  @media (min-width: 64rem) {
    .edit-error {
      top: auto;
      bottom: calc(var(--director-transport-reserve, 9.5rem) + 0.65rem);
      left: auto;
      max-width: 26rem;
    }
  }

  .readiness span {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--semantic-warning, #f3b84b);
    box-shadow: 0 0 0 0.2rem
      color-mix(in srgb, var(--semantic-warning, #f3b84b) 18%, transparent);
  }

  .readiness.ready span {
    background: var(--semantic-success, #4fd18b);
    box-shadow: 0 0 0 0.2rem
      color-mix(in srgb, var(--semantic-success, #4fd18b) 18%, transparent);
  }

  @container (max-width: 42rem) {
    .top-left {
      top: max(0.55rem, env(safe-area-inset-top));
      left: max(0.55rem, env(safe-area-inset-left));
      gap: 0.4rem;
      max-width: calc(100% - 4.3rem);
    }

    .titleplate {
      padding: 0.62rem 0.75rem;
    }

    .film-name,
    .titleplate p {
      display: none;
    }

    h1 {
      margin: 0;
      font-size: 1rem;
    }

    .readiness {
      top: max(0.55rem, env(safe-area-inset-top));
      right: max(0.55rem, env(safe-area-inset-right));
      width: 2.75rem;
      padding: 0;
      justify-content: center;
      overflow: hidden;
      color: transparent;
    }

    /* The picker spans the width here, so the actions drop below it rather
       than sharing the row and landing on top of the pills. */
  }

  @container (min-width: 1680px) {
    .top-left {
      max-width: 46rem;
    }

    .titleplate {
      padding: 1rem 1.25rem;
    }
  }
</style>
