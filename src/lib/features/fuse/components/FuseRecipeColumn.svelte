<script lang="ts">
  import type { FuseSettingsDestination } from "../domain/fuse-recipe-destination";
  import FuseRecipeSettings from "./FuseRecipeSettings.svelte";

  let {
    destination = $bindable(null),
    onClose,
  }: {
    destination?: FuseSettingsDestination;
    onClose: () => void;
  } = $props();
</script>

<!-- On desktop the recipe is a column, not a drawer: every control in it changes
     the result, and a sheet from the right covered the one panel showing that
     result. It reads left to right as cause, material, effect. -->
<aside class="fuse-recipe-column" aria-label="Fuse recipe">
  <FuseRecipeSettings bind:destination {onClose} />
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
     positioned by default. In a grid track it is the track's only occupant and
     sizes itself. */
  .fuse-recipe-column :global(.generation-settings-overlay) {
    position: static;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
