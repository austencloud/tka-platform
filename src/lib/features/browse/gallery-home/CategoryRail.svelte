<!--
  CategoryRail — the persistent desktop filter catalog.

  A vertical rail of CategoryTiles beside the active value editor, so the
  desktop workspace never forces a Back-driven drilldown. Rendered only by
  hosts that opt into `persistentDesktopCatalog`, and only once there is real
  width AND height for it (the display gate below).

  The tiles style themselves (`composition="rail"`); this component owns only
  the nav shell and the grid.

  Split out of GalleryDrill.svelte 2026-08-04.
-->
<script lang="ts">
  import CategoryTile from "./CategoryTile.svelte";
  import type {
    CategoryEntry,
    GalleryCatalog,
    Section,
  } from "./gallery-drill-catalog.svelte";

  interface Props {
    catalog: GalleryCatalog;
    section: Section;
    /** "rail" = the tall single-column catalog beside a value editor.
     *  "catalog" = the split pane's wrapping grid above the value editor. */
    layout?: "rail" | "catalog";
    /** Active rules per category key — renders the count dot. */
    ruleCounts?: Readonly<Record<string, number>>;
    /** This surface owns the category morph names right now. */
    morph?: boolean;
    onselect: (entry: CategoryEntry) => void;
  }

  let {
    catalog,
    section,
    layout = "rail",
    ruleCounts,
    morph = false,
    onselect,
  }: Props = $props();
</script>

<nav
  class="desktop-filter-catalog"
  class:catalog-layout={layout === "catalog"}
  data-section={section}
  aria-label="Filter categories"
>
  {#if layout === "rail"}<h2>Filters</h2>{/if}
  <div class="desktop-filter-grid">
    {#each [...catalog.primaryCategories, ...catalog.secondaryCategories] as entry (entry.key)}
      <CategoryTile
        {entry}
        composition={layout === "catalog" ? "catalog" : "rail"}
        active={section === entry.section}
        ruleCount={ruleCounts?.[entry.key] ?? 0}
        {morph}
        avatarFor={(name) => catalog.creatorAvatars.get(name)}
        {onselect}
      />
    {/each}
  </div>
</nav>

<style>
  /* Hidden until the two-dimensional desktop seam below. Compact phones, Fold
     modes, and portrait tablets all stay under it. */
  .desktop-filter-catalog {
    display: none;
  }

  /* Split-pane composition: every category visible as a compact labeled tile,
     two per row, above the value editor. No display gate — the pane itself is
     the gate (GalleryDrill only renders this layout past the split seam). */
  .desktop-filter-catalog.catalog-layout {
    display: block;
    flex: 0 0 auto;
    min-width: 0;
  }
  .catalog-layout .desktop-filter-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }
  /* The column itself is the container here, so this steps with the pane, not
     with the window: eleven categories go three-across once there is room,
     which keeps the catalog to four rows instead of six. */
  @container drill (min-width: 620px) {
    .catalog-layout .desktop-filter-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.6rem;
    }
  }

  @media (min-height: 650px) {
    @container drill (min-width: 900px) {
      /* The rail persists only while EDITING a value, so the first chooser
         stays a clean overview. */
      .desktop-filter-catalog:not([data-section="chooser"]) {
        display: flex;
      }

      .desktop-filter-catalog {
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        gap: 0.65rem;
        padding: 0.75rem;
        overflow: hidden;
        border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
        border-radius: 1.1rem;
        background: color-mix(
          in srgb,
          var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 72%,
          transparent
        );
      }

      .desktop-filter-catalog h2 {
        margin: 0;
        color: var(--theme-text, #e8edf6);
        font-size: 1rem;
        font-weight: 800;
      }

      .desktop-filter-grid {
        display: grid;
        min-height: 0;
        flex: 1 1 0;
        grid-template-columns: minmax(0, 1fr);
        grid-auto-rows: minmax(44px, 1fr);
        gap: 0.4rem;
        overflow: hidden;
      }
    }
  }

  @media (min-height: 1150px) {
    @container drill (min-width: 1200px) {
      .desktop-filter-catalog h2 {
        font-size: 1.15rem;
      }
    }
  }
</style>
