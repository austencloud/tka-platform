<script lang="ts">
  import { Plane } from "../../domain/enums/Plane";
  import { PlaneMode } from "../../domain/enums/PlaneMode";

  interface Props {
    mode: PlaneMode;
    bluePlane: Plane;
    redPlane: Plane;
    /** Whole-sequence planes (used in sequence mode) */
    sequenceBluePlane: Plane;
    sequenceRedPlane: Plane;
    currentBeatIndex?: number;
    totalBeats?: number;
    hasBeatOverrides?: boolean;
    /** Whether we're editing per-beat or whole-sequence */
    beatEditMode?: boolean;
    onModeChange: (mode: PlaneMode) => void;
    onHandPlaneChange: (hand: "blue" | "red", plane: Plane) => void;
    onSequenceHandPlaneChange: (hand: "blue" | "red", plane: Plane) => void;
    onBeatEditModeChange?: (enabled: boolean) => void;
  }

  let {
    mode,
    bluePlane,
    redPlane,
    sequenceBluePlane,
    sequenceRedPlane,
    currentBeatIndex = 0,
    totalBeats = 0,
    hasBeatOverrides = false,
    beatEditMode = false,
    onModeChange,
    onHandPlaneChange,
    onSequenceHandPlaneChange,
    onBeatEditModeChange,
  }: Props = $props();

  const primaryPlanes = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];

  const planeLabels: Record<string, string> = {
    [Plane.WALL]: "Wall",
    [Plane.WHEEL]: "Wheel",
    [Plane.FLOOR]: "Floor",
  };

  // In sequence mode, use whole-sequence planes. In beat mode, use per-beat planes.
  const activeBluePlane = $derived(beatEditMode ? bluePlane : sequenceBluePlane);
  const activeRedPlane = $derived(beatEditMode ? redPlane : sequenceRedPlane);

  function handlePlaneChange(hand: "blue" | "red", value: string) {
    if (beatEditMode) {
      onHandPlaneChange(hand, value as Plane);
    } else {
      onSequenceHandPlaneChange(hand, value as Plane);
    }
  }

  function resetToWall() {
    onModeChange(PlaneMode.WALL);
  }

  function toggleDualWheel() {
    if (mode === PlaneMode.DUAL_WHEEL) {
      onModeChange(PlaneMode.WALL);
    } else {
      onModeChange(PlaneMode.DUAL_WHEEL);
    }
  }

  function toggleBeatEditMode() {
    onBeatEditModeChange?.(!beatEditMode);
  }

  const isDualWheel = $derived(mode === PlaneMode.DUAL_WHEEL);
  const isNonDefault = $derived(
    mode !== PlaneMode.WALL ||
    activeBluePlane !== Plane.WALL ||
    activeRedPlane !== Plane.WALL ||
    hasBeatOverrides
  );
</script>

<div class="plane-controls">
  <button
    class="preset-btn"
    class:active={isDualWheel}
    onclick={toggleDualWheel}
    title={isDualWheel ? "Switch to wall mode" : "Switch to dual wheel mode"}
  >
    DW
  </button>

  <div class="hand-plane">
    <span class="hand-dot" style="background: #4a90d9;"></span>
    <select
      value={activeBluePlane}
      onchange={(e) => handlePlaneChange("blue", e.currentTarget.value)}
      class="plane-select"
    >
      {#each primaryPlanes as p}
        <option value={p}>{planeLabels[p]}</option>
      {/each}
    </select>
  </div>

  <div class="hand-plane">
    <span class="hand-dot" style="background: #d94a4a;"></span>
    <select
      value={activeRedPlane}
      onchange={(e) => handlePlaneChange("red", e.currentTarget.value)}
      class="plane-select"
    >
      {#each primaryPlanes as p}
        <option value={p}>{planeLabels[p]}</option>
      {/each}
    </select>
  </div>

  {#if totalBeats > 1}
    <button
      class="mode-toggle"
      class:active={beatEditMode}
      onclick={toggleBeatEditMode}
      title={beatEditMode ? "Switch to whole-sequence mode" : "Switch to per-beat mode"}
    >
      {#if beatEditMode}
        <span class="beat-indicator">{currentBeatIndex + 1}/{totalBeats}</span>
      {:else}
        ALL
      {/if}
    </button>
  {/if}

  {#if hasBeatOverrides}
    <span class="override-badge" title="Some beats have custom plane assignments">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
    </span>
  {/if}

  {#if isNonDefault}
    <button class="reset-btn" onclick={resetToWall} title="Reset all to Wall">
      <i class="fas fa-undo" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .plane-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .hand-plane {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .plane-select {
    padding: 4px 10px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    outline: none;
  }

  .plane-select:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .plane-select option {
    background: #1a1a2e;
    color: #fff;
  }

  .reset-btn {
    padding: 4px 10px;
    min-height: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reset-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .preset-btn {
    padding: 4px 12px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
  }

  .preset-btn.active {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
    color: rgba(255, 255, 255, 0.9);
  }

  .mode-toggle {
    padding: 4px 12px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.45);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .mode-toggle:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.7);
  }

  .mode-toggle.active {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    color: rgba(255, 255, 255, 0.85);
  }

  .beat-indicator {
    font-variant-numeric: tabular-nums;
  }

  .override-badge {
    display: flex;
    align-items: center;
    padding: 4px 6px;
    color: rgba(139, 92, 246, 0.7);
    font-size: 10px;
  }
</style>
