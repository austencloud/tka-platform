<script lang="ts">
  /**
   * Viewer3DViewPresets
   *
   * Camera angle presets for the 3D viewer: Main, Front, Side, Top, 3/4.
   * All presets look at the grid center (shoulder height, forward of avatar).
   * Distance is computed from FOV + viewport size so the grid fills the view.
   *
   * Accepts a `compact` boolean for smaller sizing when rendered inside the gear popover.
   */

  import { getViewer3DContext } from "../context/viewer-3d-context";

  const { compact = false }: { compact?: boolean } = $props();

  const viewer3DState = getViewer3DContext();

  // Grid center in world space: avatar at origin, grid 0.3m forward at shoulder height
  const GRID_CENTER = { x: 0, y: 1.55, z: -0.3 };
  const GZ = GRID_CENTER.z;
  const GY = GRID_CENTER.y;

  // Compute camera distance so the grid nicely fills the viewport.
  // Grid radius in 3D = 0.52m, we want it to occupy ~46% of viewport width.
  // Uses the same FOV (50°) as Viewer3DCamera.
  const FOV_DEG = 50;
  const GRID_RADIUS = 0.52;
  const GRID_FILL_FRACTION = 0.46;

  function computeDistance(): number {
    if (typeof document === "undefined") return 3.0;
    // Find the 3D pane to get aspect ratio
    const pane = document.querySelector(".viewer-3d-canvas");
    if (!pane) return 3.0;
    const rect = pane.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 3.0;
    const aspect = rect.width / rect.height;
    const vFovRad = (FOV_DEG / 2) * Math.PI / 180;
    const hFovHalf = Math.atan(Math.tan(vFovRad) * aspect);
    const visibleWidthPerMeter = 2 * Math.tan(hFovHalf);
    return (GRID_RADIUS * 2) / (GRID_FILL_FRACTION * visibleWidthPerMeter);
  }

  function getPresetPositions(): Record<string, { x: number; y: number; z: number }> {
    const D = computeDistance();
    // Avatar faces -Z. Camera at +Z sees the avatar's back (Main/behind).
    // Camera at -Z sees the avatar's face (Front).
    return {
      main:         { x: 0,         y: GY,           z: GZ + D },       // behind performer (+Z)
      front:        { x: 0,         y: GY,           z: GZ - D },       // facing performer (-Z)
      side:         { x: D,         y: GY,           z: GZ },           // stage right (+X)
      top:          { x: 0,         y: GY + D,       z: GZ + 0.01 },    // overhead, slight +Z bias
      threequarter: { x: D * 0.55,  y: GY + D * 0.4, z: GZ + D * 0.75 }, // elevated behind-right
    };
  }

  const CAMERA_PRESETS: { id: string; label: string }[] = [
    { id: "main",         label: "Main" },
    { id: "front",        label: "Front" },
    { id: "side",         label: "Side" },
    { id: "top",          label: "Top" },
    { id: "threequarter", label: "3/4" },
  ];

  const activeCameraPreset = $derived(viewer3DState.activeCameraPreset);

  function handleCameraPreset(presetId: string) {
    const positions = getPresetPositions();
    const pos = positions[presetId];
    if (!pos) return;

    // DEBUG: log preset positions and target
    const D = computeDistance();
    console.log(`[CameraPreset] "${presetId}" → pos:`, pos, `target:`, GRID_CENTER, `distance: ${D.toFixed(3)}`);

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
</style>
