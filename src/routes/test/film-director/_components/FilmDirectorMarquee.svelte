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

  // Scene titles come from the resolved spec, not the input: a chance film's
  // scenes only get their real shape once the seed has been rolled. Five short
  // documents, resolved once.
  const startingPoints = FILM_LIBRARY.map((entry) => {
    const spec = resolveFilmDirectorSpec(entry.film);
    return {
      key: entry.key,
      label: entry.label,
      poster: entry.poster.src,
      sceneCount: spec.scenes.length,
      durationSeconds: spec.durationSeconds,
      sceneTitles: spec.scenes.map((scene) => scene.title),
      performerCount: spec.scenes[0]?.performance.performers.length ?? 0,
    };
  });

  // A poster is a baked artifact, so a missing one means the bake has not run
  // for this film yet. Loud in dev, an icon in production.
  let posterMissing = $state<Record<string, boolean>>({});

  function handlePosterError(key: string, src: string): void {
    posterMissing[key] = true;
    if (import.meta.env.DEV) {
      console.warn(
        `[Director] No poster at ${src}. Run: node scripts/build-film-posters.mjs --only ${key}`
      );
    }
  }

  $effect(() => {
    // Drive seam for scripts/build-film-posters.mjs: the bake reads its cues
    // from the registry rather than keeping a second copy of them. Dev only.
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__filmPosterCues =
      FILM_LIBRARY.map((entry) => ({ key: entry.key, ...entry.poster }));
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

<main class="marquee" data-film-director-marquee>
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
            <span class="poster">
              {#if posterMissing[film.key]}
                <i class="fas fa-clapperboard" aria-hidden="true"></i>
              {:else}
                <img
                  src={film.poster}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onerror={() => handlePosterError(film.key, film.poster)}
                />
              {/if}
            </span>
            <span class="card-head">
              <strong>{film.label}</strong>
              <span class="meta">
                {film.sceneCount === 1 ? "1 scene" : `${film.sceneCount} scenes`}
                <span aria-hidden="true">·</span>
                {formatDuration(film.durationSeconds)}
                <span aria-hidden="true">·</span>
                {film.performerCount === 1
                  ? "1 performer"
                  : `${film.performerCount} performers`}
              </span>
            </span>
            <!-- Flow content, not a list: a button may only contain phrasing
                 content, and an <ol> here is invalid HTML. -->
            <span class="scenes">
              {#each film.sceneTitles as title, index (index)}
                <span class="scene">
                  <span class="scene-index">{index + 1}</span>
                  {title}
                </span>
              {/each}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <!-- No heading here: the module carries its own "Saved films" header and count. -->
  <FilmCollectionModule onopen={onOpenSavedFilm} />
</main>

<style>
  /* Nothing else on the page ramps the root, so the marquee carries the same
     16px→24px lockstep the stage does. Without it a 3840 viewport renders
     1080p type in the middle of a 2600px band. */
  @media (min-width: 1680px) {
    :global(html:has([data-film-director-marquee])) {
      font-size: clamp(1rem, 0.61rem + 0.37vw, 1.5rem);
    }
  }

  /* The route pins `body { overflow: hidden }` for the stage, so the marquee
     owns its own scroll rather than growing a clipped page. Grid rather than
     flow: the saved-films shelf is another component's root, which scoped CSS
     cannot reach with a sibling margin. */
  .marquee {
    position: fixed;
    inset: 0;
    display: grid;
    justify-items: center;
    /* safe center: with an empty shelf the composition is far shorter than a
       4K viewport, and pinning it to the top dead-ends the page a third of the
       way down. Once the shelf fills past the viewport, `safe` falls back to
       start so the top stays reachable. */
    align-content: safe center;
    row-gap: clamp(2rem, 4vw, 3.5rem);
    padding: clamp(1.5rem, 4vw, 3rem) 0 clamp(3rem, 8vw, 6rem);
    overflow-y: auto;
    color: var(--theme-text, #fff);
    background: #070812;
  }

  .marquee > :global(*) {
    width: var(--shell-w, min(1720px, 92vw));
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

  /* Matches the saved-films shelf's own heading, which this cannot restyle. */
  h2 {
    margin: 0 0 1rem;
    font-size: 1.05rem;
  }

  /* Pinned counts, not auto-fill: five known cards against a minmax floor
     strands the fifth on its own row as the viewport grows. Three is the only
     count above one that leaves no orphan — 5 % 3 = 2, while 2 and 4 both
     strand a single card on the last row. */
  .card-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  /* 60rem, not the usual 48rem: three columns at tablet width squeeze a scene
     title like "The lead and the copies" into a 13rem card. Below this the
     cards run full width, which 5 items fill without an orphan row. */
  @media (min-width: 60rem) {
    .card-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.25rem;
    }
  }

  .card-grid button {
    display: grid;
    width: 100%;
    height: 100%;
    align-content: start;
    gap: 0.9rem;
    padding: 1.25rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    color: inherit;
    background:
      radial-gradient(
        120% 80% at 12% 0%,
        color-mix(in srgb, var(--theme-accent, #7869eb) 30%, transparent),
        transparent 62%
      ),
      var(--theme-panel-bg, #10111b);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 140ms ease;
  }

  /* One card per row is wide enough that a stacked head-over-list leaves the
     right half empty. Between the phone stack and the three-column tier the
     card turns on its side instead. */
  @media (min-width: 34rem) and (max-width: 59.999rem) {
    .card-grid button {
      grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
      gap: 1.5rem;
    }

    .poster {
      grid-column: 1 / -1;
    }

    .scenes {
      padding: 0 0 0 1.5rem;
      border-top: none;
      border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }

  .card-grid button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .card-grid button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  /* Bleeds to the card edge. A poster inset by the card's own padding reads as
     a thumbnail stuck onto a list row rather than as the face of the card.
     aspect-ratio reserves the box before the image decodes, so a card never
     grows under the cursor. */
  .poster {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    margin: -1.25rem -1.25rem 0;
    overflow: hidden;
    border-radius: calc(1rem - 1px) calc(1rem - 1px) 0 0;
    color: var(--theme-accent, #b0a4ff);
    background: color-mix(in srgb, var(--theme-accent, #7869eb) 12%, #05060f);
    font-size: 1.6rem;
  }

  .poster img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-head {
    display: grid;
    align-content: start;
    gap: 0.3rem;
  }

  .card-grid strong {
    font-size: clamp(1.15rem, 1.1vw, 1.5rem);
    line-height: 1.15;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .scenes {
    display: grid;
    align-content: start;
    gap: 0.3rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    min-height: 0;
    overflow: hidden;
  }

  .scene {
    display: flex;
    gap: 0.55rem;
    align-items: baseline;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.78));
    font-size: var(--font-size-min, 0.875rem);
  }

  .scene-index {
    flex: 0 0 auto;
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-grid button {
      transition: none;
    }
  }
</style>
