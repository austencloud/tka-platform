<script lang="ts">
  import type { FuseSettingsDestination } from "../domain/fuse-recipe-destination";
  import FuseRecipeSettings from "./FuseRecipeSettings.svelte";

  let {
    destination = $bindable(null),
    singleDestination = false,
    onClose,
  }: {
    destination?: FuseSettingsDestination;
    singleDestination?: boolean;
    onClose: () => void;
  } = $props();
</script>

<!-- On desktop the recipe is a column, not a drawer: every control in it changes
     the result, and a sheet from the right covered the one panel showing that
     result. It reads left to right as cause, material, effect. -->
<aside class="fuse-recipe-column" aria-label="Fuse recipe">
  <FuseRecipeSettings bind:destination {singleDestination} {onClose} />
</aside>

<style>
  .fuse-recipe-column {
    position: relative;
    grid-area: recipe;
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* GenerationSettingsOverlay is authored to cover a card, so it is absolutely
     positioned by default. In a grid track it is the track's only occupant.

     It is pinned to the track's OPEN width rather than left to fill, so the
     growing track reveals a finished panel instead of dragging its contents
     through 280ms of reflow — the editors inside re-wrap at several widths, and
     watching them re-wrap is what made the open read as a stutter. The track's
     `overflow: hidden` does the revealing. */
  .fuse-recipe-column :global(.generation-settings-overlay) {
    position: static;
    flex: 0 0 auto;
    width: var(--fuse-recipe-open-w, 100%);
    min-width: 0;
    min-height: 0;
  }
</style>
