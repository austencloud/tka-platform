<script lang="ts">
  /**
   * Viewer3DViewPresets
   *
   * Camera angle presets for the 3D viewer: Main, Back, Side, Top, 3/4.
   * All presets look at the grid center. Grid center is mode-dependent:
   * - Wall mode: (0, 0, 0.3) - gridOffset forward of avatar
   * - Dual-wheel: (0, 0, 0) - midpoint between the two lateral grids
   *
   * Distance is computed from FOV + viewport size so the grid fills the view.
   */

  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { PlaneMode } from "@austencloud/scene-3d";
  import { GRID_OFFSETS } from "@austencloud/scene-3d";
  import { userProportionsState } from "@austencloud/scene-3d";

  const { compact = false, flat = false, grid = false }: { compact?: boolean; flat?: boolean; grid?: boolean } = $props();

  const viewer3DState = getViewer3DContext();
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);
  const isDualWheel = $derived(avatarState?.planeMode === PlaneMode.DUAL_WHEEL);

  const gridCenter = $derived({
    x: 0,
    y: viewer3DState.stageGroundOffset,
    z: isDualWheel ? 0 : (GRID_OFFSETS[PlaneMode.WALL] ?? 0.3),
  });

  const FOV_DEG = 50;
  const GRID_RADIUS = 0.52;
  const GRID_FILL_FRACTION = 0.20;
  const dualWheelOffset = $derived(userProportionsState.staffLength / 2);

  function computeDistanceForWidth(sceneWidth: number): number {
    if (typeof document === "undefined") return 3.0;
    const pane = document.querySelector(".viewer-3d-canvas");
    if (!pane) return 3.0;
    const rect = pane.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 3.0;
    const aspect = rect.width / rect.height;
    const vFovRad = (FOV_DEG / 2) * Math.PI / 180;
    const hFovHalf = Math.atan(Math.tan(vFovRad) * aspect);
    const visibleWidthPerMeter = 2 * Math.tan(hFovHalf);
    return sceneWidth / (GRID_FILL_FRACTION * visibleWidthPerMeter);
  }

  function computeDistance(): number {
    const sceneWidth = isDualWheel
      ? 2 * (dualWheelOffset + GRID_RADIUS)
      : GRID_RADIUS * 2;
    return computeDistanceForWidth(sceneWidth);
  }

  function computeSideDistance(): number {
    const singleWidth = GRID_RADIUS * 2;
    const dualWidth = 2 * (dualWheelOffset + GRID_RADIUS);
    return computeDistanceForWidth((singleWidth + dualWidth) / 2);
  }

  function getPresetPositions(): Record<string, { x: number; y: number; z: number }> {
    const D = computeDistance();
    const S = computeSideDistance();
    const gz = gridCenter.z;
    const gy = gridCenter.y;
    const positions: Record<string, { x: number; y: number; z: number }> = {
      main:         { x: 0,          y: gy,           z: gz + D },
      back:         { x: 0,          y: gy,           z: gz - D * 1.3 },
      left:         { x: S,          y: gy,           z: gz },
      right:        { x: -S,         y: gy,           z: gz },
      top:          { x: 0,          y: gy + D,       z: gz },
      threequarter: { x: D * 0.55,   y: gy + D * 0.4, z: gz - D * 0.75 },
    };
    return positions;
  }

  interface ViewPreset { id: string; label: string; icon: string; }

  const activePresets: ViewPreset[] = [
    { id: "main",         label: "Front", icon: "fa-street-view" },
    { id: "back",         label: "Back",  icon: "fa-eye" },
    { id: "top",          label: "Top",   icon: "fa-angles-down" },
    { id: "left",         label: "Left",  icon: "fa-arrow-left" },
    { id: "right",        label: "Right", icon: "fa-arrow-right" },
    { id: "threequarter", label: "3/4",   icon: "fa-cube" },
  ];

  const activeCameraPreset = $derived(viewer3DState.activeCameraPreset);

  function getLookTarget(_presetId: string): { x: number; y: number; z: number } {
    return gridCenter;
  }

  function handleCameraPreset(presetId: string) {
    const positions = getPresetPositions();
    const pos = positions[presetId];
    if (!pos) return;

    viewer3DState.setActiveCameraPreset(presetId);
    const spherical = presetId === "top"
      ? { azimuth: 0, polar: 0 }
      : undefined;
    viewer3DState.snapCameraTo(pos, getLookTarget(presetId), spherical);
  }
</script>

{#if flat}
  {#each activePresets as preset}
    <button
      class="preset-button"
      class:active={activeCameraPreset === preset.id}
      onclick={() => handleCameraPreset(preset.id)}
      aria-label={`Camera: ${preset.label}`}
    >
      <i class="fas {preset.icon}"></i>
      {preset.label}
    </button>
  {/each}
{:else}
  <div class="presets-bar" class:compact class:grid>
    {#each activePresets as preset}
      <button
        class="preset-button"
        class:active={activeCameraPreset === preset.id}
        onclick={() => handleCameraPreset(preset.id)}
        aria-label={`Camera: ${preset.label}`}
      >
        <i class="fas {preset.icon}"></i>
        <span class="preset-label">{preset.label}</span>
      </button>
    {/each}
  </div>
{/if}

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
    min-height: var(--min-touch-target-compact, 32px);
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .preset-button i {
    font-size: 11px;
    opacity: 0.5;
    transition: opacity 180ms;
  }

  .compact .preset-button {
    min-height: var(--min-touch-target-compact, 32px);
    padding: 4px 9px;
  }

  .preset-button:hover {
    color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  .preset-button:hover i {
    opacity: 0.85;
  }

  .preset-button.active {
    color: #cfe4ff;
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 40%, transparent);
    box-shadow: 0 2px 12px color-mix(in srgb, #4a9eff 20%, transparent);
  }

  .preset-button.active i {
    opacity: 1;
    color: #8fc3ff;
  }

  .presets-bar.grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    padding: 6px;
    background: transparent;
    border: none;
    backdrop-filter: none;
  }

  .grid .preset-button {
    min-height: 52px;
    padding: 10px 10px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-direction: column;
    gap: 5px;
    justify-content: center;
  }

  .grid .preset-button i {
    font-size: 14px;
  }

  .grid .preset-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .grid .preset-button.active {
    background: color-mix(in srgb, #4a9eff 22%, transparent);
    border-color: color-mix(in srgb, #4a9eff 55%, transparent);
    box-shadow: 0 4px 16px color-mix(in srgb, #4a9eff 25%, transparent);
  }
</style>
