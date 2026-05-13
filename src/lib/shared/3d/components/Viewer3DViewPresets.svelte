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
  // Used only to read planeMode for dual-wheel detection. Reads performer 0.
  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);
  const isDualWheel = $derived(avatarState?.planeMode === PlaneMode.DUAL_WHEEL);

  // Grid center in world space - depends on plane mode.
  // Wall: grid T.Group at z = gridOffset = 0.3. Y=0 is shoulder height.
  // Dual-wheel: two grids at x = ±0.4, z = 0. Midpoint is origin.
  const gridCenter = $derived({
    x: 0,
    y: 0,
    z: isDualWheel ? 0 : (GRID_OFFSETS[PlaneMode.WALL] ?? 0.3),
  });

  // Camera distance computation.
  // Uses FOV (50°) and viewport aspect ratio to fill the grid in the view.
  // Dual-wheel lateral offset = half staff length so endpoints touch.
  const FOV_DEG = 50;
  const GRID_RADIUS = 0.52;
  const GRID_FILL_FRACTION = 0.46;
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

  // Side views use a consistent distance regardless of mode -
  // midpoint between single-grid and dual-grid widths.
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
      main:         { x: 0,          y: gy,           z: gz + D },        // seeing performer's face
      back:         { x: 0,          y: gy,           z: gz - D },        // behind performer
      left:         { x: S,          y: gy,           z: gz },            // performer's left side
      right:        { x: -S,         y: gy,           z: gz },            // performer's right side
      top:          { x: 0,          y: gy + D,       z: gz - 0.05 },     // overhead
      threequarter: { x: D * 0.55,   y: gy + D * 0.4, z: gz - D * 0.75 }, // elevated behind-right
    };
    return positions;
  }

  const activePresets: { id: string; label: string }[] = [
    { id: "main",         label: "Front" },
    { id: "back",         label: "Back" },
    { id: "top",          label: "Top" },
    { id: "left",         label: "Left" },
    { id: "right",        label: "Right" },
    { id: "threequarter", label: "3/4" },
  ];

  const activeCameraPreset = $derived(viewer3DState.activeCameraPreset);

  function getLookTarget(presetId: string): { x: number; y: number; z: number } {
    // All presets look at the scene center
    return gridCenter;
  }

  function handleCameraPreset(presetId: string) {
    const positions = getPresetPositions();
    const pos = positions[presetId];
    if (!pos) return;

    viewer3DState.setActiveCameraPreset(presetId);
    viewer3DState.snapCameraTo(pos, getLookTarget(presetId));
  }
</script>

{#if flat}
  {#each activePresets as preset}
    <button
      class="preset-button"
      class:active={activeCameraPreset === preset.id}
      onclick={() => handleCameraPreset(preset.id)}
      aria-label={`Camera: ${preset.label}`}
    >{preset.label}</button>
  {/each}
{:else}
  <div class="presets-bar" class:compact class:grid>
    {#each activePresets as preset}
      <button
        class="preset-button"
        class:active={activeCameraPreset === preset.id}
        onclick={() => handleCameraPreset(preset.id)}
        aria-label={`Camera: ${preset.label}`}
      >{preset.label}</button>
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

  .presets-bar.grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3px;
  }

  .grid .preset-button {
    min-height: 36px;
    padding: 8px 10px;
    font-size: 13px;
  }
</style>
