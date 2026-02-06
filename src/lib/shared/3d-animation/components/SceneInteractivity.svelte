<script lang="ts">
  /**
   * SceneInteractivity
   *
   * Must be placed as a direct child of Canvas to enable pointer events on 3D objects.
   * The interactivity plugin uses Svelte context, so it MUST be called inside the Canvas tree.
   */
  import { interactivity } from "@threlte/extras";
  import { onMount } from "svelte";

  // Call the plugin to set up event handling - this injects into the Canvas context
  // Don't destructure the return value as it contains reactive state that can cause loops
  interactivity();

</script>
