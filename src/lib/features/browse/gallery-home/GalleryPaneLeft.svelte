<!--
  GalleryPaneLeft — the split pane's filter column, and the height budget that
  divides it between its two zones.

  The column is not two stacked content-sized boxes. It is a budget: the value
  editor takes what its screen needs at the screen's own per-card ceiling
  (`--editor-need`, measured by `pane-height-budget.ts`) and the catalog grows
  into everything left over, up to a ceiling of its own. Whichever zone can use
  the space gets it — Austen, 2026-08-05: "maybe it should morph up and down".

  Split out of GalleryDrill.svelte 2026-08-05 (Task 9).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import CategoryRail from "./CategoryRail.svelte";
  import { heightBudget } from "./pane-height-budget";
  import type {
    CategoryEntry,
    GalleryCatalog,
    Section,
  } from "./gallery-drill-catalog.svelte";

  interface Props {
    catalog: GalleryCatalog;
    section: Section;
    /** Active rules per category key — renders the tiles' count dots. */
    ruleCounts?: Readonly<Record<string, number>>;
    /** Entered via "Show all": no value editor, the catalog owns the column. */
    idle: boolean;
    onSelectCategory: (entry: CategoryEntry) => void;
    /** The active value editor (a Crossfade over the workspace screens). */
    editor: Snippet;
    width?: number;
  }

  let {
    catalog,
    section,
    ruleCounts,
    idle,
    onSelectCategory,
    editor,
    width = $bindable(0),
  }: Props = $props();
</script>

<div
  class="pane-left"
  class:idle
  bind:clientWidth={width}
  use:heightBudget={`${section}:${idle}`}
>
  <CategoryRail
    {catalog}
    {section}
    layout="catalog"
    {ruleCounts}
    morph
    fill={idle}
    onselect={onSelectCategory}
  />
  {#if idle}
    <p class="pane-idle">Pick a category above to narrow it down.</p>
  {:else}
    <div class="drill-editor-stage">{@render editor()}</div>
  {/if}
</div>

<style>
  .pane-left {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    min-height: 0;
    /* The value editors query `drill`; naming the column re-points every one
       of those queries at THIS box, so a 420px column composes its cards the
       way a 420px screen does instead of trying to run the 3-across desktop
       monument layout inside it. */
    container-type: inline-size;
    container-name: drill;
  }

  /* ── The budget ──────────────────────────────────────────────────────
     Editor: basis = what its screen needs at its card ceiling. It shrinks
     (and scrolls) when the column is short, and takes a small share of any
     surplus the catalog cannot use.
     Catalog: never shrinks below its natural rows, grows 4:1 into the surplus
     until its own ceiling, then hands the rest back. */
  .drill-editor-stage {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 0;
    flex: 1 1 var(--editor-need, 100%);
    flex-direction: column;
    overflow: hidden;
    /* The allocation morphs as the screen changes; animating the basis is
       what makes that read as a shift of space rather than a jump cut. */
    transition: flex-basis 0.24s var(--ease-smooth, ease);
  }
  .pane-left :global(.desktop-filter-catalog.catalog-layout) {
    /* 8:1 against the editor. The editor already has what it asked for, so the
       surplus belongs to the tiles — but it keeps a small share so that when
       the catalog hits its ceiling the remainder lands inside a panel rather
       than as a gap between the two. */
    flex: 8 0 auto;
    transition: flex-basis 0.24s var(--ease-smooth, ease);
  }
  @media (prefers-reduced-motion: reduce) {
    .drill-editor-stage,
    .pane-left :global(.desktop-filter-catalog.catalog-layout) {
      transition: none;
    }
  }

  /* ONE surface for the whole workspace — the results pane declares the same
     token family in GalleryDrill, so the three zones read as one system. */
  .pane-left :global(.desktop-filter-catalog.catalog-layout),
  .drill-editor-stage {
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1.1rem;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #11131a) 72%,
      transparent
    );
  }

  /* No category open: the catalog IS the column, so it takes all of it. */
  .pane-left.idle :global(.desktop-filter-catalog.catalog-layout) {
    flex: 1 1 0;
  }
  .pane-idle {
    flex: 0 0 auto;
    margin: 0;
    padding: 0.25rem 0.5rem;
    color: var(--theme-text-muted, #9aa6b8);
    font-size: 0.9rem;
    text-align: center;
  }
</style>
