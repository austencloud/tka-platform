<script lang="ts">
  import type { FuseRecipeDestination } from "../domain/fuse-recipe-destination";
  import FusePathRecipePanel from "./FusePathRecipePanel.svelte";
  import FuseRecipeBasics from "./FuseRecipeBasics.svelte";
  import FuseRelationshipComposer from "./FuseRelationshipComposer.svelte";

  let {
    destination,
    presentation = "drawer",
    onCancel = () => {},
    onApply = () => {},
  }: {
    destination: FuseRecipeDestination;
    presentation?: "drawer" | "popover";
    onCancel?: () => void;
    onApply?: () => void;
  } = $props();
</script>

{#if destination === "length" || destination === "level" || destination === "grid"}
  <FuseRecipeBasics section={destination} {presentation} />
{:else if destination === "style" || destination === "starting"}
  <FusePathRecipePanel section={destination} {presentation} />
{:else}
  <FuseRelationshipComposer {presentation} {onCancel} {onApply} />
{/if}
