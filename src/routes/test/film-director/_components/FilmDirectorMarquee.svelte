<script lang="ts">
  import FilmCollectionModule from "$lib/features/film-collection/FilmCollectionModule.svelte";
  import type { CollectedFilm } from "$lib/features/film-collection/domain/film-collection-types";
  import { FILM_LIBRARY } from "../_films/index";
  import { resolveFilmDirectorSpec } from "../_lib/resolve-film-director-spec";

  let {
    onOpenLibraryFilm,
    onOpenSavedFilm,
  }: {
    onOpenLibraryFilm: (key: string) => void;
    onOpenSavedFilm: (entry: CollectedFilm) => void;
  } = $props();

  // A library film has no stored poster or denormalized meta, so the card's
  // chips come from resolving it. Five short documents, resolved once.
  const startingPoints = FILM_LIBRARY.map((entry) => {
    const spec = resolveFilmDirectorSpec(entry.film);
    return {
      key: entry.key,
      label: entry.label,
      sceneCount: spec.scenes.length,
      durationSeconds: spec.durationSeconds,
    };
  });

  function formatDuration(seconds: number): string {
    const whole = Math.round(seconds);
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
  }

  // The collection is started by the route, which needs it loaded before this
  // component mounts in order to resolve a ?film=saved: link.
</script>

<main class="marquee">
  <header class="marquee-header">
    <span class="kicker">Director</span>
    <h1>Films</h1>
  </header>

  <section aria-labelledby="starting-points">
    <h2 id="starting-points">Starting points</h2>
    <ul class="card-grid">
      {#each startingPoints as film (film.key)}
        <li>
          <button type="button" onclick={() => onOpenLibraryFilm(film.key)}>
            <strong>{film.label}</strong>
            <span class="meta">
              {film.sceneCount === 1 ? "1 scene" : `${film.sceneCount} scenes`}
              <span aria-hidden="true">·</span>
              {formatDuration(film.durationSeconds)}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="saved-films">
    <h2 id="saved-films">Saved films</h2>
    <FilmCollectionModule onopen={onOpenSavedFilm} />
  </section>
</main>

<style>
  /* The route pins `body { overflow: hidden }` for the stage, so the marquee
     owns its own scroll rather than growing a clipped page. */
  .marquee {
    position: fixed;
    inset: 0;
    padding: clamp(1.5rem, 4vw, 3rem) 0 clamp(3rem, 8vw, 6rem);
    overflow-y: auto;
    color: var(--theme-text, #fff);
    background: #070812;
  }

  .marquee > :global(*) {
    width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
  }

  .marquee-header {
    margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
  }

  .kicker {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.9rem, 4vw, 3rem);
    line-height: 1.1;
  }

  section + section {
    margin-top: clamp(2rem, 5vw, 3.5rem);
  }

  h2 {
    margin: 0 0 1rem;
    font-size: clamp(1.05rem, 1.6vw, 1.4rem);
  }

  /* Pinned counts, not auto-fill: five known cards against a minmax floor
     strands the fifth on its own row as the viewport grows. */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  @media (min-width: 48rem) {
    .card-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 105rem) {
    .card-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  .card-grid button {
    display: grid;
    width: 100%;
    min-height: 8.5rem;
    align-content: end;
    gap: 0.45rem;
    padding: 1.1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    color: inherit;
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--theme-accent, #7869eb) 16%, transparent),
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .card-grid button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .card-grid button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .card-grid strong {
    font-size: clamp(1rem, 1.2vw, 1.2rem);
  }

  .meta {
    display: flex;
    gap: 0.3rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }
</style>
