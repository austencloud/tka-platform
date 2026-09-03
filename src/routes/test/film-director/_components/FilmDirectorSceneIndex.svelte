<!--
  FilmDirectorSceneIndex — the scene catalog, as a modal inside a booted film.

  A film is a linear watch, which is the wrong shape for inspecting one thing.
  Proving Grounds is 23 scenes; someone who wants to see the dolly zoom should
  not have to sit through the ten scenes in front of it. Every scene already
  carries an authored `intent` — a written statement of what it proves and what
  to watch for — and this panel renders it.

  The grid, the grouping and the card belong to SceneCatalog, which the marquee
  also renders before any film has booted. This component is the in-film host:
  it owns the modal chrome, the filter input's placement in the header, and the
  two actions only a running film can offer — solo a scene, or release solo and
  play from the top. Switching scenes here is instant, because the stage is
  already warm; from the marquee the same pick pays the one scene boot.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";

  import { getFilmDirectorContext } from "../_lib/film-director-context";
  import SceneCatalog from "./SceneCatalog.svelte";
  import type { CatalogScene } from "./scene-catalog-types";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const director = getFilmDirectorContext();

  let query = $state("");

  // Reset per open, so a reopened index never hides scenes behind a filter the
  // user typed a minute ago and has since forgotten.
  $effect(() => {
    if (!open) return;
    query = "";
  });

  const scenes = $derived<CatalogScene[]>(
    director.film.scenes.map((scene, index) => ({
      index,
      id: scene.id,
      title: scene.title,
      intent: scene.intent,
      seconds: scene.durationSeconds,
      category: scene.category,
    }))
  );

  function soloScene(scene: CatalogScene): void {
    director.setSoloScene(scene.index);
    director.play();
    open = false;
  }

  function playWholeFilm(): void {
    director.setSoloScene(null);
    director.seek(0);
    director.play();
    open = false;
  }
</script>

<BaseModal bind:open size="xl" labelledBy="scene-index-title">
  {#snippet header()}
    <div class="index-header">
      <div class="index-heading">
        <span class="kicker">{director.film.title}</span>
        <h2 id="scene-index-title">
          {scenes.length}
          {scenes.length === 1 ? "scene" : "scenes"}
        </h2>
      </div>

      <div class="index-tools">
        <!-- Two dozen scenes is more than a glance can hold, and the intent
             text is where the vocabulary actually lives: typing "orbit" or
             "handheld" finds the scenes that demonstrate it. Ids are matched
             too, so a link pasted back from the address bar finds its card. -->
        <input
          class="index-filter"
          type="search"
          placeholder="Filter scenes"
          aria-label="Filter scenes by name, id, or description"
          bind:value={query}
        />
        <button type="button" class="index-close" onclick={() => (open = false)}>
          <i class="fas fa-xmark" aria-hidden="true"></i>
          Close
        </button>
      </div>
    </div>
  {/snippet}

  <div class="index-body">
    {#if director.soloSceneIndex !== null}
      <button type="button" class="release-solo" onclick={playWholeFilm}>
        <i class="fas fa-list-ol" aria-hidden="true"></i>
        <span>
          Playing one scene on a loop. Play the whole film from the top instead.
        </span>
      </button>
    {/if}

    <SceneCatalog
      {scenes}
      bind:query
      onPick={soloScene}
      soloIndex={director.soloSceneIndex}
      currentIndex={director.frame.sceneIndex}
    />
  </div>
</BaseModal>

<style>
  .index-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 1.15rem 1.25rem 0.9rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }

  .index-heading {
    display: grid;
    gap: 0.15rem;
  }

  .kicker {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: 1.3rem;
  }

  /* nowrap, so the filter and Close stay one row: a wrapped tools column makes
     the header twice as tall and strands the title beside dead space. */
  .index-tools {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.5rem;
  }

  /* A flat width, not min(16rem, 100%). The percentage resolves against a
     container this element is itself sizing, so it drops out of the row's
     max-content contribution — the row then measures narrower than the controls
     inside it and wraps them onto two lines. */
  .index-filter {
    min-width: 0;
    width: 16rem;
    max-width: 100%;
    min-height: 2.75rem;
    padding: 0 0.85rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 0.7rem;
    outline: none;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
  }

  .index-filter:focus-visible {
    border-color: var(--theme-accent, #9d8cff);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #9d8cff) 24%, transparent);
  }

  .index-close {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 0.7rem;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    white-space: nowrap;
    cursor: pointer;
  }

  .index-close:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .index-close:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .index-body {
    padding: 0.9rem 1.25rem 1.25rem;
  }

  .release-solo {
    display: flex;
    width: 100%;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.75rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #9d8cff) 55%, transparent);
    border-radius: 0.7rem;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 20%,
      transparent
    );
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    text-align: left;
    cursor: pointer;
  }

  .release-solo:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .release-solo:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .release-solo i {
    flex: 0 0 auto;
    color: var(--theme-accent, #b0a4ff);
  }

  @media (max-width: 34rem) {
    .index-header {
      padding: 0.9rem 1rem 0.75rem;
    }

    .index-tools {
      width: 100%;
    }

    .index-filter {
      flex: 1 1 8rem;
      width: auto;
    }

    .index-body {
      padding: 0.75rem 1rem 1rem;
    }
  }
</style>
