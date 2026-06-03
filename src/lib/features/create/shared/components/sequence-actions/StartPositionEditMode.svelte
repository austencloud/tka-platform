<!--
  StartPositionEditMode.svelte

  Orientation editing for start positions. Shows dual orientation pickers
  for blue and red props. Uses PropControlPair for consistent layout.
-->
<script lang="ts">
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import PropControlPair from "./PropControlPair.svelte";
  import PropOrientationControl from "./PropOrientationControl.svelte";

  interface Props {
    startPositionData: StepData | null;
    stacked?: boolean;
    onOrientationChange: (color: MotionColor, orientation: string) => void;
  }

  let {
    startPositionData,
    stacked = false,
    onOrientationChange,
  }: Props = $props();

  // Get current orientations from the start position data
  const blueOrientation = $derived(
    startPositionData?.motions?.[MotionColor.BLUE]?.startOrientation ?? "in"
  );
  const redOrientation = $derived(
    startPositionData?.motions?.[MotionColor.RED]?.startOrientation ?? "in"
  );
</script>

{#if !startPositionData}
  <div class="empty-state">
    <i class="fas fa-compass" aria-hidden="true"></i>
    <p>No start position selected</p>
  </div>
{:else}
  <PropControlPair {stacked}>
    {#snippet blueContent()}
      <PropOrientationControl
        color="blue"
        orientation={blueOrientation}
        onOrientationChange={(orientation) =>
          onOrientationChange(MotionColor.BLUE, orientation)}
      />
    {/snippet}
    {#snippet redContent()}
      <PropOrientationControl
        color="red"
        orientation={redOrientation}
        onOrientationChange={(orientation) =>
          onOrientationChange(MotionColor.RED, orientation)}
      />
    {/snippet}
  </PropControlPair>
{/if}

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 16px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
  }

  .empty-state i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 0.9rem;
    margin: 0;
  }
</style>
