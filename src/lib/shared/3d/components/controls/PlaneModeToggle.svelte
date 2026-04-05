<script lang="ts">
  import { Plane } from "../../domain/enums/Plane";
  import { PlaneMode } from "../../domain/enums/PlaneMode";

  interface Props {
    mode: PlaneMode;
    bluePlane: Plane;
    redPlane: Plane;
    onModeChange: (mode: PlaneMode) => void;
    onHandPlaneChange: (hand: "blue" | "red", plane: Plane) => void;
  }

  let { mode, bluePlane, redPlane, onModeChange, onHandPlaneChange }: Props = $props();

  const primaryPlanes = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];

  const planeLabels: Record<string, string> = {
    [Plane.WALL]: "Wall",
    [Plane.WHEEL]: "Wheel",
    [Plane.FLOOR]: "Floor",
  };

  function handlePlaneChange(hand: "blue" | "red", value: string) {
    onHandPlaneChange(hand, value as Plane);
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

  const isDualWheel = $derived(mode === PlaneMode.DUAL_WHEEL);
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
      value={bluePlane}
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
      value={redPlane}
      onchange={(e) => handlePlaneChange("red", e.currentTarget.value)}
      class="plane-select"
    >
      {#each primaryPlanes as p}
        <option value={p}>{planeLabels[p]}</option>
      {/each}
    </select>
  </div>

  {#if mode !== PlaneMode.WALL || bluePlane !== Plane.WALL || redPlane !== Plane.WALL}
    <button class="reset-btn" onclick={resetToWall} title="Reset both to Wall">
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
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .plane-select {
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact, 12px);
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
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .preset-btn {
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-compact, 12px);
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
</style>
