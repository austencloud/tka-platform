<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryControls.svelte
  The Theory ribbon. Same cells, same order, same behaviour as the Matrix
  ribbon: Apply to, then the value band for the chosen axis. Where the Matrix
  scrolls TKA turn values, Theory scrolls prop-to-hand ratios.

  Timing and direction are NOT here. They sit above the animation in the detail
  pane, which is where the Matrix has always kept them.

  The ratio is TYPED rather than scrolled. The Matrix scrolls turn values
  because there are eight of them and they are a ladder; the ratio field spans
  every pair from 0 through 15, so a viewer who knows they want 12:5 says 12:5
  instead of hunting through a catalog. -->
<script lang="ts">
  import ShapeMatrixAxisControl from "./ShapeMatrixAxisControl.svelte";
  import ShapeMatrixRatioEntry from "./ShapeMatrixRatioEntry.svelte";

  interface Props {
    /** Ribbon: the header band. Tray: the compact detail sheet. */
    layout?: "ribbon" | "tray";
  }
  let { layout = "ribbon" }: Props = $props();
</script>

<div class="theory-editor" class:tray={layout === "tray"}>
  <ShapeMatrixAxisControl {layout} steers="the ratio control" />
  <ShapeMatrixRatioEntry {layout} />
</div>

<style>
  .theory-editor {
    display: flex;
    flex: 0 1 auto;
    align-items: stretch;
    gap: 0.5rem;
    min-width: 0;
  }

  .theory-editor.tray {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .theory-editor:not(.tray) {
      gap: 0.4rem;
    }
  }

  @container shape-matrix-app (max-width: 25rem) {
    .theory-editor:not(.tray) {
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
</style>
