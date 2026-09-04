<script lang="ts">
  import type { ForestVariant } from "./domain/enums/environment-enums";
  import type { ForestSceneConfig } from "./domain/models/scene-configs";
  import ForestConfigurableScene from "./forest/ForestConfigurableScene.svelte";
  import ForestProductionScene from "./forest/ForestProductionScene.svelte";

  interface Props {
    variant?: ForestVariant;
    config?: ForestSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    showStage?: boolean;
    clearingRadius?: number;
    active?: boolean;
  }

  let {
    variant = "firefly",
    config,
    stageWidth = 6,
    stageDepth = 4.5,
    stageZOffset = 0,
    showStage = true,
    clearingRadius,
    active = true,
  }: Props = $props();

  // The shared world is the exact, complete production clearing. Widened hub
  // layouts intentionally omit its authored close frame and/or stage; keep
  // those specialized compositions on the established conditional adapter so
  // they do not download hidden multi-megabyte GLBs.
  const usesCompleteProductionWorld = $derived(
    config === undefined && clearingRadius === undefined && showStage
  );
</script>

{#if !usesCompleteProductionWorld}
  <ForestConfigurableScene
    {variant}
    {config}
    {stageWidth}
    {stageDepth}
    {stageZOffset}
    {showStage}
    {clearingRadius}
    {active}
  />
{:else}
  <ForestProductionScene
    {stageWidth}
    {stageDepth}
    {stageZOffset}
    {showStage}
    {clearingRadius}
    {active}
  />
{/if}
