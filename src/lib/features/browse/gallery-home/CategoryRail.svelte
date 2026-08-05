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
    onselect: (entry: CategoryEntry) => void;
  }

  let { catalog, section, onselect }: Props = $props();
</script>

<nav
  class="desktop-filter-catalog"
  data-section={section}
  aria-label="Filter categories"
>
  <h2>Filters</h2>
  <div class="desktop-filter-grid">
    {#each [...catalog.primaryCategories, ...catalog.secondaryCategories] as entry (entry.key)}
      <CategoryTile
        {entry}
        composition="rail"
        active={section === entry.section}
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
