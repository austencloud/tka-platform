<!--
  StartPositionEditMode.svelte

  Location and orientation controls for both props in the selected start
  position. Location changes transform the prop through the whole sequence.
-->
<script lang="ts">
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { TargetHand } from "$lib/shared/create/domain/panel-types";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import PropControlPair from "./PropControlPair.svelte";
  import MobileHandSelector from "./MobileHandSelector.svelte";
  import PropLocationControl from "./PropLocationControl.svelte";
  import PropOrientationControl from "./PropOrientationControl.svelte";

  interface Props {
    startPositionData: StepData | null;
    stacked?: boolean;
    compact?: boolean;
    focused?: boolean;
    activeMoveColor?: MotionColor | null;
    repositionDisabled?: boolean;
    isRepositioning?: boolean;
    onOrientationChange: (color: MotionColor, orientation: string) => void;
    onLocationRotate: (
      color: MotionColor,
      direction: "clockwise" | "counterclockwise"
    ) => void;
    onMoveProp: (color: MotionColor) => void;
  }

  let {
    startPositionData,
    stacked = false,
    compact = false,
    focused = false,
    activeMoveColor = null,
    repositionDisabled = false,
    isRepositioning = false,
    onOrientationChange,
    onLocationRotate,
    onMoveProp,
  }: Props = $props();

  const blueMotion = $derived(startPositionData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(startPositionData?.motions?.[MotionColor.RED]);
  const blueLocation = $derived(
    blueMotion?.startLocation ?? GridLocation.CENTER
  );
  const redLocation = $derived(redMotion?.startLocation ?? GridLocation.CENTER);
  const blueOrientation = $derived(blueMotion?.startOrientation ?? "in");
  const redOrientation = $derived(redMotion?.startOrientation ?? "in");
  let visibleHand = $state<TargetHand>("blue");

  const HAND_OPTIONS: {
    hand: TargetHand;
    label: string;
    shortLabel: string;
  }[] = [
    { hand: "blue", label: "Blue", shortLabel: "Blue" },
    { hand: "red", label: "Red", shortLabel: "Red" },
  ];

  // Stacked and focused layouts are both too narrow for two cards side by side,
  // so they share the hand picker and show one prop at a time.
  const usesHandPicker = $derived(stacked || focused);

  const statusMessage = $derived(
    isRepositioning
      ? "Updating every step."
      : repositionDisabled
        ? "Location controls are unavailable while a prop is at center."
        : ""
  );
</script>

{#snippet propControls(
  color: MotionColor,
  location: GridLocation,
  orientation: string
)}
  <div class="prop-controls">
    <div class="control-field">
      <span class="field-label">Location</span>
      <PropLocationControl
        color={color === MotionColor.BLUE ? "blue" : "red"}
        {location}
        active={activeMoveColor === color}
        disabled={repositionDisabled || isRepositioning}
        {compact}
        onRotate={(direction) => onLocationRotate(color, direction)}
        onChoose={() => onMoveProp(color)}
      />
    </div>

    <div class="control-field">
      <span class="field-label">Orientation</span>
      <PropOrientationControl
        color={color === MotionColor.BLUE ? "blue" : "red"}
        {orientation}
        {compact}
        disabled={isRepositioning}
        onOrientationChange={(nextOrientation) =>
          onOrientationChange(color, nextOrientation)}
      />
    </div>
  </div>
{/snippet}

{#if !startPositionData}
  <div class="empty-state">
    <i class="fas fa-compass" aria-hidden="true"></i>
    <p>No start position selected</p>
  </div>
{:else}
  <section
    class="start-position-controls"
    class:compact
    class:focused
    aria-busy={isRepositioning}
  >
    <p class="impact-message">Changes here update every step.</p>
    <span class="screen-reader-status" aria-live="polite">
      {statusMessage}
    </span>

    {#if usesHandPicker}
      <MobileHandSelector
        value={visibleHand}
        onChange={(hand) => (visibleHand = hand)}
        options={HAND_OPTIONS}
        ariaLabel="Choose start position prop. Changes update every step."
        fullWidth
      />
    {/if}

    <PropControlPair
      {stacked}
      {compact}
      prominentLabels
      visibleHand={usesHandPicker ? visibleHand : "both"}
    >
      {#snippet blueContent()}
        {@render propControls(MotionColor.BLUE, blueLocation, blueOrientation)}
      {/snippet}
      {#snippet redContent()}
        {@render propControls(MotionColor.RED, redLocation, redOrientation)}
      {/snippet}
    </PropControlPair>
  </section>
{/if}

<style>
  .start-position-controls {
    display: grid;
    gap: 10px;
    width: 100%;
    max-width: clamp(44rem, 72cqw, 68rem);
    margin-inline: auto;
  }

  .start-position-controls.compact {
    gap: 6px;
  }

  .impact-message {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: clamp(var(--font-size-min, 14px), 1cqw, 1.125rem);
    line-height: 1.35;
  }

  .screen-reader-status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .prop-controls {
    display: grid;
    gap: 12px;
    width: 100%;
  }

  .compact .prop-controls {
    gap: 8px;
  }

  /* A short landscape phone cannot show two full cards and leave room for the
     placement board. One prop stays mounted at a time, while its two fields
     share a row and the hand picker keeps the other prop one tap away. */
  .start-position-controls.focused .prop-controls {
    --prop-cycle-compact-columns: var(--min-touch-target, 44px)
      minmax(52px, 1fr) var(--min-touch-target, 44px);
    --prop-cycle-compact-gap: 4px;
    --prop-cycle-value-gap: 4px;
    --prop-cycle-value-padding: 4px;

    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .start-position-controls.focused .control-field {
    width: 100%;
    min-width: 0;
  }

  /* At this height the sentence costs a quarter of the usable preview. Its
     meaning remains in the hand picker's accessible name, while the regular
     layouts keep the visible reminder. */
  .start-position-controls.focused .impact-message {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .control-field {
    display: grid;
    gap: 6px;
    width: min(100%, clamp(18rem, 28cqw, 24rem));
    margin-inline: auto;
  }

  .field-label {
    color: var(--theme-text, #fff);
    font-size: clamp(var(--font-size-min, 14px), 1cqw, 1.125rem);
    font-weight: 650;
    line-height: 1.25;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-align: center;
  }

  .empty-state i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }
</style>
