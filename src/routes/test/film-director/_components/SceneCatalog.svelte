<!--
  SceneCatalog — the grouped, filterable grid of scenes and what each one is for.

  Extracted from FilmDirectorSceneIndex when a second host needed the same
  thing. The modal index is reachable only after a film has booted, which is
  the wrong door for a reference: Proving Grounds is a catalog of capabilities,
  and reading the catalog should not cost a 3D scene boot. The marquee shows
  the same cards before anything mounts, so picking a capability is the first
  action on the page rather than the second.

  This component owns matching, grouping, and the card. The host owns its own
  chrome — a modal header and a Close button in one case, a page section
  heading in the other — and binds `query` so the filter input can live
  wherever that chrome puts it.

  The card leads with the scene id, not its position. The id is the stable
  address (`?film=<key>&scene=<id>`); the position changes the moment a scene
  is added or, as the orbit twin was, deleted.
-->
<script lang="ts">
  import {
    DIRECTOR_SCENE_CATEGORIES,
    DIRECTOR_SCENE_CATEGORY_LABELS,
  } from "../_lib/film-director-schema";
  import type { CatalogScene } from "./scene-catalog-types";

  let {
    scenes,
    onPick,
    query = $bindable(""),
    soloIndex = null,
    currentIndex = null,
    lead = "Pick a scene to watch it on its own, looping.",
  }: {
    scenes: CatalogScene[];
    onPick: (scene: CatalogScene) => void;
    query?: string;
    soloIndex?: number | null;
    currentIndex?: number | null;
    lead?: string;
  } = $props();

  const matches = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scenes;
    return scenes.filter((scene) =>
      `${scene.title} ${scene.id} ${scene.intent ?? ""}`
        .toLowerCase()
        .includes(needle)
    );
  });

  const grouped = $derived(scenes.some((scene) => scene.category !== undefined));

  // Declared order, and empty groups are dropped rather than shown empty: a
  // filter that matches only camera scenes should leave one heading standing,
  // not six with nothing under five of them.
  const groups = $derived.by(() => {
    const ordered: { key: string; label: string; scenes: CatalogScene[] }[] = [];
    for (const category of DIRECTOR_SCENE_CATEGORIES) {
      const inCategory = matches.filter((scene) => scene.category === category);
      if (inCategory.length === 0) continue;
      ordered.push({
        key: category,
        label: DIRECTOR_SCENE_CATEGORY_LABELS[category],
        scenes: inCategory,
      });
    }
    // A film that categorizes some scenes and not others is a mistake worth
    // seeing rather than hiding, so the stragglers get a heading of their own.
    const uncategorized = matches.filter(
      (scene) => scene.category === undefined
    );
    if (uncategorized.length > 0) {
      ordered.push({
        key: "other",
        label: "Uncategorized",
        scenes: uncategorized,
      });
    }
    return ordered;
  });

  function formatSeconds(seconds: number): string {
    return `${Math.round(seconds)}s`;
  }
</script>

<!-- The live region reports the filter's effect. The grid below is a list of
     controls, not a status, so it cannot announce this itself. -->
<p class="catalog-count" aria-live="polite">
  {#if query.trim()}
    {matches.length} of {scenes.length} match “{query.trim()}”
  {:else}
    {lead}
  {/if}
</p>

{#snippet sceneCard(scene: CatalogScene)}
  <li>
    <button
      type="button"
      class="scene-card"
      class:soloed={scene.index === soloIndex}
      aria-current={scene.index === currentIndex ? "true" : undefined}
      onclick={() => onPick(scene)}
    >
      <span class="scene-meta">
        <span class="scene-id">{scene.id}</span>
        <span class="scene-duration">{formatSeconds(scene.seconds)}</span>
      </span>
      <span class="scene-title">{scene.title}</span>
      {#if scene.intent}
        <span class="scene-intent">{scene.intent}</span>
      {/if}
    </button>
  </li>
{/snippet}

{#if grouped}
  {#each groups as group (group.key)}
    <section class="scene-group">
      <h3 class="group-heading">
        <span class="group-label">{group.label}</span>
        <span class="group-count">{group.scenes.length}</span>
      </h3>
      <ul class="scene-grid">
        {#each group.scenes as scene (scene.id)}
          {@render sceneCard(scene)}
        {/each}
      </ul>
    </section>
  {/each}
{:else}
  <ul class="scene-grid">
    {#each matches as scene (scene.id)}
      {@render sceneCard(scene)}
    {/each}
  </ul>
{/if}

{#if matches.length === 0}
  <p class="catalog-empty">No scene mentions “{query.trim()}”.</p>
{/if}

<style>
  .catalog-count,
  .catalog-empty {
    margin: 0 0 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.66));
    font-size: var(--font-size-min, 0.875rem);
  }

  .catalog-empty {
    margin: 0.5rem 0 0;
  }

  .scene-group + .scene-group {
    margin-top: 1.35rem;
  }

  /* Baseline-aligned so the count reads as an annotation on the word rather
     than a badge floating beside it. The rule fills the rest of the row, which
     is what makes a heading legible as a divider without a heavier weight. */
  .group-heading {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0 0 0.6rem;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .group-label {
    color: var(--theme-accent, #b0a4ff);
  }

  .group-count {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  .group-heading::after {
    flex: 1 1 auto;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    content: "";
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

  /* Monospace because this is the literal string a director types after
     `?scene=`, and because it wraps in the middle of a hyphenated id rather
     than pushing the duration off the row. */
  .scene-id {
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .scene-duration {
    flex: 0 0 auto;
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
</style>
