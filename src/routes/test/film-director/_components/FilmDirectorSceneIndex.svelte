<!--
  FilmDirectorSceneIndex — every scene in the film, with what it is for.

  A film is a linear watch, which is the wrong shape for inspecting one thing.
  Proving Grounds is 24 scenes and 3:36; someone who wants to see the dolly zoom
  should not have to sit through the eleven scenes in front of it. Every scene
  already carries an authored `intent` — a written statement of what it proves
  and what to watch for — and until this panel nothing rendered it. So the index
  is both the map and the explanation: read what a scene is for, click it, and
  playback confines itself to that scene on a loop.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";

  import { getFilmDirectorContext } from "../_lib/film-director-context";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const director = getFilmDirectorContext();

  let query = $state("");

  // Reset per open, so a reopened index never hides scenes behind a filter the
  // user typed a minute ago and has since forgotten.
  $effect(() => {
    if (!open) return;
    query = "";
  });

  const scenes = $derived(
    director.film.scenes.map((scene, index) => ({
      index,
      id: scene.id,
      title: scene.title,
      intent: scene.intent,
      seconds: scene.durationSeconds,
    }))
  );

  const matches = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scenes;
    return scenes.filter((scene) =>
      `${scene.title} ${scene.intent ?? ""}`.toLowerCase().includes(needle)
    );
  });

  function formatSeconds(seconds: number): string {
    return `${Math.round(seconds)}s`;
  }

  function soloScene(index: number): void {
    director.setSoloScene(index);
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
        <!-- A 24-scene film is more than a glance can hold, and the intent text
             is where the vocabulary actually lives: typing "orbit" or "camera"
             finds the scenes that demonstrate it. -->
        <input
          class="index-filter"
          type="search"
          placeholder="Filter scenes"
          aria-label="Filter scenes by name or description"
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

    <!-- The live region reports the filter's effect. The grid below is a list
         of controls, not a status, so it cannot announce this itself. -->
    <p class="index-count" aria-live="polite">
      {#if query.trim()}
        {matches.length} of {scenes.length} match “{query.trim()}”
      {:else}
        Pick a scene to watch it on its own, looping.
      {/if}
    </p>

    <ul class="scene-grid">
      {#each matches as scene (scene.id)}
        <li>
          <button
            type="button"
            class="scene-card"
            class:soloed={scene.index === director.soloSceneIndex}
            aria-current={scene.index === director.frame.sceneIndex
              ? "true"
              : undefined}
            onclick={() => soloScene(scene.index)}
          >
            <span class="scene-meta">
              <span class="scene-number">
                {String(scene.index + 1).padStart(2, "0")}
              </span>
              <span class="scene-duration">{formatSeconds(scene.seconds)}</span>
            </span>
            <span class="scene-title">{scene.title}</span>
            {#if scene.intent}
              <span class="scene-intent">{scene.intent}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    {#if matches.length === 0}
      <p class="index-empty">No scene mentions “{query.trim()}”.</p>
    {/if}
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

  .index-count,
  .index-empty {
    margin: 0 0 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.66));
    font-size: var(--font-size-min, 0.875rem);
  }

  .index-empty {
    margin: 0.5rem 0 0;
  }

  .scene-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* The card owns the whole tile: state is a full perimeter and a wash across
     the surface, never a strip down one edge. */
  .scene-card {
    display: grid;
    width: 100%;
    height: 100%;
    align-content: start;
    gap: 0.3rem;
    padding: 0.85rem 0.95rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.85rem;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color var(--transition-fast, 120ms) ease,
      background-color var(--transition-fast, 120ms) ease;
  }

  .scene-card:hover {
    border-color: var(--theme-accent, #9d8cff);
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 14%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
  }

  .scene-card:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .scene-card[aria-current="true"],
  .scene-card.soloed {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #9d8cff) 70%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 22%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
  }

  .scene-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .scene-number {
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .scene-title {
    font-size: 1rem;
    font-weight: 750;
    line-height: 1.3;
  }

  .scene-intent {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-card {
      transition: none;
    }
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
