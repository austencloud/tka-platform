<script lang="ts">
  /**
   * Viewer3DViewPresets
   *
   * Camera angle presets for the 3D viewer: Main, Front, Side, Top, 3/4.
   * Front is the former "mirror" main position — same scene, no color swapping.
   *
   * Accepts a `compact` boolean for smaller sizing when rendered inside the gear popover.
   */

  import { getViewer3DContext } from "../context/viewer-3d-context";

  const { compact = false }: { compact?: boolean } = $props();

  const viewer3DState = getViewer3DContext();

  // Grid center: avatar faces -Z, grid offset is at -0.3 Z
  const GRID_CENTER = { x: 0, y: 1.55, z: -0.3 };

  const D = 2.4;   // approximate aligned distance
  const Y = 1.59;  // approximate aligned Y
  const GZ = -0.3; // grid center Z

  const CAMERA_POSITIONS: Record<string, { x: number; y: number; z: number }> = {
    main:         { x: 0,         y: Y,       z: GZ - D },
    front:        { x: 0,         y: Y,       z: GZ + D },
    side:         { x: D,         y: Y,       z: GZ },
    top:          { x: 0,         y: GRID_CENTER.y + 3.0, z: GZ - 0.01 },
    threequarter: { x: D * 0.6,   y: Y + 1.0, z: GZ - D * 0.8 },
  };

  const CAMERA_PRESETS: { id: string; label: string }[] = [
    { id: "main",         label: "Main" },
    { id: "front",        label: "Front" },
    { id: "side",         label: "Side" },
    { id: "top",          label: "Top" },
    { id: "threequarter", label: "3/4" },
  ];

  const activeCameraPreset = $derived(viewer3DState.activeCameraPreset);

  function handleCameraPreset(presetId: string) {
    const pos = CAMERA_POSITIONS[presetId];
    viewer3DState.setActiveCameraPreset(presetId);
    viewer3DState.snapCameraTo(pos, GRID_CENTER);
  }
</script>

<div class="presets-bar" class:compact>
  {#each CAMERA_PRESETS as preset}
    <button
      class="preset-button"
      class:active={activeCameraPreset === preset.id}
      onclick={() => handleCameraPreset(preset.id)}
      aria-label={`Camera: ${preset.label}`}
    >{preset.label}</button>
  {/each}
</div>

<style>
  .presets-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
  }

  .preset-button {
    padding: 6px 11px;
    min-height: var(--min-touch-target, 44px);
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .compact .preset-button {
    min-height: var(--min-touch-target-compact, 32px);
    padding: 4px 9px;
  }

  .preset-button:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.08);
  }

  .preset-button.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }
</style>
