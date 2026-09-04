<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryControls.svelte
  The Theory ribbon follows the Matrix's control order: Apply to, then the
  prop-to-hand ratio for the chosen axis.

  Timing and direction are NOT here. They sit above the animation in the detail
  pane, which is where the Matrix has always kept them.

  The ratio is typed rather than scrolled. The Matrix scrolls turn values
  because they form a short ladder; Theory accepts every pair from 0 through
  15, so a viewer who wants 12:5 can say 12:5 directly. -->
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
