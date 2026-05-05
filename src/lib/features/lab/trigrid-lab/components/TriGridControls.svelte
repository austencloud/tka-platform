<!--
  TriGridControls.svelte - Sidebar controls for the trigrid lab.

  Mode toggle, position selector, per-hand orientation pickers, motion type selector,
  and visibility toggles.
-->
<script lang="ts">
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { TriGridMode, TriGridMotionType } from "../domain/trigrid-types";
  import { TRIGRID_ORIENTATIONS } from "../domain/trigrid-types";
  import { getTriGridPositions } from "../domain/trigrid-positions";

  interface Props {
    mode: TriGridMode;
    blueLocation: GridLocation;
    redLocation: GridLocation;
    blueOrientation: Orientation;
    redOrientation: Orientation;
    motionType: TriGridMotionType;
    showGrid: boolean;
    onModeChange: (mode: TriGridMode) => void;
    onPositionChange: (blue: GridLocation, red: GridLocation) => void;
    onBlueOrientationChange: (o: Orientation) => void;
    onRedOrientationChange: (o: Orientation) => void;
    onMotionTypeChange: (t: TriGridMotionType) => void;
    onToggleGrid: () => void;
  }

  const {
    mode,
    blueLocation,
    redLocation,
    blueOrientation,
    redOrientation,
    motionType,
    showGrid,
    onModeChange,
    onPositionChange,
    onBlueOrientationChange,
    onRedOrientationChange,
    onMotionTypeChange,
    onToggleGrid,
  }: Props = $props();

  const positions = $derived(getTriGridPositions(mode));
  const motionTypes: TriGridMotionType[] = ["pro", "anti", "float", "static"];

  const orientationLabels: Record<string, string> = {
    [Orientation.IN]: "In",
    [Orientation.CLOCK_IN]: "ClkIn",
    [Orientation.CLOCK_OUT]: "ClkOut",
    [Orientation.OUT]: "Out",
    [Orientation.COUNTER_OUT]: "CtrOut",
    [Orientation.COUNTER_IN]: "CtrIn",
  };
</script>

<div class="controls">
  <!-- Mode toggle -->
  <section class="control-section">
    <h3>Mode</h3>
    <div class="toggle-group mode-grid">
      <button
        class="toggle-btn"
        class:active={mode === "upright"}
        onclick={() => onModeChange("upright")}
        aria-pressed={mode === "upright"}
      >
        <i class="fas fa-caret-up" aria-hidden="true"></i>
        Up
      </button>
      <button
        class="toggle-btn"
        class:active={mode === "inverted"}
        onclick={() => onModeChange("inverted")}
        aria-pressed={mode === "inverted"}
      >
        <i class="fas fa-caret-down" aria-hidden="true"></i>
        Down
      </button>
      <button
        class="toggle-btn"
        class:active={mode === "left"}
        onclick={() => onModeChange("left")}
        aria-pressed={mode === "left"}
      >
        <i class="fas fa-caret-left" aria-hidden="true"></i>
        Left
      </button>
      <button
        class="toggle-btn"
        class:active={mode === "right"}
        onclick={() => onModeChange("right")}
        aria-pressed={mode === "right"}
      >
        <i class="fas fa-caret-right" aria-hidden="true"></i>
        Right
      </button>
    </div>
  </section>

  <!-- Position selector -->
  <section class="control-section">
    <h3>Position</h3>
    <div class="position-list">
      {#each positions as pos}
        <button
          class="position-btn"
          class:active={blueLocation === pos.blueLocation && redLocation === pos.redLocation}
          onclick={() => onPositionChange(pos.blueLocation, pos.redLocation)}
        >
          <span class="pos-group" class:beta={pos.group === "beta"} class:gamma={pos.group === "gamma"}>
            {pos.group === "beta" ? "B" : "G"}{pos.index}
          </span>
          <span class="pos-label">{pos.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- Orientation pickers -->
  <section class="control-section">
    <h3>Blue Orientation</h3>
    <div class="orientation-grid">
      {#each TRIGRID_ORIENTATIONS as ori}
        <button
          class="ori-btn blue"
          class:active={blueOrientation === ori}
          onclick={() => onBlueOrientationChange(ori)}
          title={orientationLabels[ori]}
        >
          {orientationLabels[ori]}
        </button>
      {/each}
    </div>
  </section>

  <section class="control-section">
    <h3>Red Orientation</h3>
    <div class="orientation-grid">
      {#each TRIGRID_ORIENTATIONS as ori}
        <button
          class="ori-btn red"
          class:active={redOrientation === ori}
          onclick={() => onRedOrientationChange(ori)}
          title={orientationLabels[ori]}
        >
          {orientationLabels[ori]}
        </button>
      {/each}
    </div>
  </section>

  <!-- Motion type -->
  <section class="control-section">
    <h3>Motion Type</h3>
    <div class="toggle-group">
      {#each motionTypes as mt}
        <button
          class="toggle-btn"
          class:active={motionType === mt}
          onclick={() => onMotionTypeChange(mt)}
          aria-pressed={motionType === mt}
        >
          {mt}
        </button>
      {/each}
    </div>
  </section>

  <!-- Visibility toggles -->
  <section class="control-section">
    <h3>Display</h3>
    <div class="toggle-list">
      <label class="toggle-label">
        <input type="checkbox" checked={showGrid} onchange={onToggleGrid} />
        Grid
      </label>
    </div>
  </section>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-section {
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .control-section h3 {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0 0 8px 0;
  }

  .toggle-group {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .toggle-group.mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .toggle-btn {
    flex: 1;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
    text-transform: capitalize;
  }

  .toggle-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn.active {
    background: var(--theme-accent, #10b981);
    border-color: var(--theme-accent, #10b981);
    color: #ffffff;
  }

  .position-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .position-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .position-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .position-btn.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-accent, #10b981);
    color: var(--theme-text, #ffffff);
  }

  .pos-group {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    flex-shrink: 0;
  }

  .pos-group.beta {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .pos-group.gamma {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .pos-label {
    font-size: var(--font-size-compact, 12px);
  }

  .orientation-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .ori-btn {
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ori-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .ori-btn.blue.active {
    background: rgba(37, 99, 235, 0.3);
    border-color: #2563eb;
    color: #60a5fa;
  }

  .ori-btn.red.active {
    background: rgba(220, 38, 38, 0.3);
    border-color: #dc2626;
    color: #f87171;
  }

  .toggle-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    min-height: 32px;
  }

  .toggle-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--theme-accent, #10b981);
  }
</style>
