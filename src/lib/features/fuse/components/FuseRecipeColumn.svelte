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
     the result, and a sheet over the result covered the one panel showing what
     the controls were doing. As a track it pushes instead of covers, and it
     opens on the same edge as the buttons that summon it. -->
<aside class="fuse-recipe-column" aria-label="Fuse recipe">
  <FuseRecipeSettings bind:destination {singleDestination} {onClose} />
</aside>

<style>
  /* `flex-end` because the track grows leftward off the workspace's right edge:
     pinning the panel to that edge means the widening track uncovers it from the
     right, the direction it is travelling. Pinned to the left edge instead, the
     panel would sit still while a gap opened beside it. */
  .fuse-recipe-column {
    position: relative;
    grid-area: recipe;
    display: flex;
    justify-content: flex-end;
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
