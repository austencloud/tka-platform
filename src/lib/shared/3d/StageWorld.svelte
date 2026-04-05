<script lang="ts">
  /**
   * StageWorld
   *
   * Unified entry point for the performance stage within an explorable forest world.
   * Unified entry point for the Stage + Infinite Worlds experience.
   *
   * Users can perform sequences on the stage grid at the center, then walk away
   * into the procedural forest terrain. The forest is the default (and only)
   * environment for now.
   *
   * Usage:
   * <StageWorld />
   * or with custom props:
   * <StageWorld showDebug={true} />
   */

  import WorldScene from "$lib/features/realm/components/scene/WorldScene.svelte";
  import { PERFORMANCE_STAGE_CONFIG } from "$lib/features/realm/core/realm-definitions";

  interface Props {
    /** Show debug info overlay */
    showDebug?: boolean;
  }

  let { showDebug = false }: Props = $props();
</script>

<WorldScene
  realmConfig={PERFORMANCE_STAGE_CONFIG}
  stageMode={true}
  {showDebug}
/>
