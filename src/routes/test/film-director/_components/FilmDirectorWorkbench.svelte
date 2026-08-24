<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    DEFAULT_FILM_KEY,
    FILM_LIBRARY,
    getLibraryFilm,
    isLibraryFilmKey,
  } from "../_films/index";
  import { setFilmDirectorContext } from "../_lib/film-director-context";
  import { createFilmDirectorState } from "../_lib/film-director-state.svelte";
  import FilmDirectorJsonEditor from "./FilmDirectorJsonEditor.svelte";
  import FilmDirectorScene from "./FilmDirectorScene.svelte";
  import FilmDirectorTransport from "./FilmDirectorTransport.svelte";

  // `?film=<key>` boots straight into one film, so a film is a link rather
  // than a click - shareable, bookmarkable, and drivable from a script or a
  // screenshot pass. Read once at construction: the workbench owns the
  // selection from here on and writes the URL back to match.
  const requestedFilmKey = page.url.searchParams.get("film");
  const initialFilmKey =
    requestedFilmKey && isLibraryFilmKey(requestedFilmKey)
      ? requestedFilmKey
      : DEFAULT_FILM_KEY;

  const director = createFilmDirectorState(getLibraryFilm(initialFilmKey));
  setFilmDirectorContext(director);

  let selectedFilmKey = $state(initialFilmKey);

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
    if (key === selectedFilmKey) return;
    if (!director.loadFilm(getLibraryFilm(key))) return;
    selectedFilmKey = key;
    syncFilmToUrl(key);
  }

  function syncFilmToUrl(key: string): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("film", key);
    replaceState(url, {});
  }

  onMount(() => {
    // Stamp the resolved key even when the URL arrived bare or with a key the
    // library no longer has, so the address bar always names what is on screen.
    if (requestedFilmKey !== selectedFilmKey) syncFilmToUrl(selectedFilmKey);
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
        <strong>{director.preparation.shotTitle}</strong>
        <span class="preparation-count">
          Shot {director.preparation.shotIndex + 1} of {director.preparation
            .totalShots}
        </span>
        <div class="preparation-track" aria-hidden="true">
          <span
            style:width={`${(director.preparation.preparedSteps / director.preparation.totalSteps) * 100}%`}
          ></span>
        </div>
      </div>
    </div>
  {/if}

  <div class="top-left">
    <div class="titleplate">
      <span class="film-name">{director.film.title}</span>
      <h1>{director.frame.shot.title}</h1>
      <p>
        Shot {director.frame.shotIndex + 1} of {director.film.shots.length}
        <span aria-hidden="true">·</span>
        {director.frame.shot.scene.environmentId}
        <span aria-hidden="true">·</span>
        {director.frame.shot.performance.performers.length} performers
        <span aria-hidden="true">·</span>
        {director.frame.shot.performance.bpm} BPM
      </p>
    </div>
    <div class="film-picker themed-scrollbar">
      <div class="film-picker-track">
        <SegmentedControl
          options={filmOptions}
          value={selectedFilmKey}
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

  <FilmDirectorTransport />
  <FilmDirectorJsonEditor />
</main>

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
