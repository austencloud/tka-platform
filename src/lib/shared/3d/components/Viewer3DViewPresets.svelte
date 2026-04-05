<script lang="ts">
  /**
   * Viewer3DViewPresets
   *
   * Two controls:
   * 1. Learn/Mirror toggle — determines handedness (data swap) and default camera side
   * 2. Camera presets — Main, Side, Top, 3/4 — adapt positions based on active mode
   *
   * Learn mode: performer does the exact sequence, camera behind (same direction).
   * Mirror mode: blue↔red swapped so performer mirrors you, camera in front (face to face).
   * Camera presets flip their positions based on which mode is active.
   */

  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { PlaneMode } from "../domain/enums/PlaneMode";

  const viewer3DState = getViewer3DContext();

  // In dual-wheel mode, Learn/Mirror don't apply — always view from stage right (Side).
  const isDualWheel = $derived(viewer3DState.avatarState?.planeMode === PlaneMode.DUAL_WHEEL);

  // Grid center: avatar faces -Z, so grid offset is at -0.3 Z
  const GRID_CENTER = { x: 0, y: 1.55, z: -0.3 };

  // Avatar faces -Z (GLTF convention). Back faces +Z.
  // Learn = behind avatar (see back) = camera at -Z (same side avatar faces)
  // Mirror = in front (see face) = camera at +Z (behind avatar's back)
  // NOTE: this is counterintuitive but verified with screenshots.
  // From -Z looking +Z, pictograph matches when you orbit to the back.
  // The avatar's "face" direction in GLTF doesn't match the grid direction.
  // Presets use the same distance as the computed camera alignment.
  // The exact distance varies by viewport but ~2.4m is typical for 46% grid fill.
  // These values are approximate — the Main preset should match the camera's
  // dynamically computed position when clicked via the snapTo mechanism.
  const D = 2.4; // approximate aligned distance
  const Y = 1.59; // approximate aligned Y
  const GZ = -0.3; // grid center Z

  const CAMERA_POSITIONS = {
    main: {
      learn:  { x: 0,  y: Y, z: GZ - D },
      mirror: { x: 0,  y: Y, z: GZ + D },
    },
    side: {
      learn:  { x: D,   y: Y, z: GZ },
      mirror: { x: -D,  y: Y, z: GZ },
    },
    top: {
      learn:  { x: 0, y: GRID_CENTER.y + 3.0, z: GZ - 0.01 },
      mirror: { x: 0, y: GRID_CENTER.y + 3.0, z: GZ + 0.01 },
    },
    threequarter: {
      learn:  { x: D * 0.6, y: Y + 1.0, z: GZ - D * 0.8 },
      mirror: { x: -D * 0.6, y: Y + 1.0, z: GZ + D * 0.8 },
    },
  };

  type CameraPresetId = keyof typeof CAMERA_POSITIONS;

  const CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
    { id: "main", label: "Main" },
    { id: "side", label: "Side" },
    { id: "top", label: "Top" },
    { id: "threequarter", label: "3/4" },
  ];

  const mode = $derived(viewer3DState.mirrorMode ? 'mirror' : 'learn');
  const activeCameraPreset = $derived(viewer3DState.activeCameraPreset);

  const sublabel = $derived.by(() => {
    if (viewer3DState.mirrorMode) {
      return "Face to face \u2022 colors swapped so your red = their red";
    }
    return "Same direction \u2022 your right = their right";
  });

  function handleModeToggle(mirror: boolean) {
    viewer3DState.setMirrorMode(mirror);
    // Snap camera to main preset for the new mode
    const pos = CAMERA_POSITIONS.main[mirror ? 'mirror' : 'learn'];
    viewer3DState.setActiveCameraPreset('main');
    viewer3DState.snapCameraTo(pos, GRID_CENTER);
  }

  function handleCameraPreset(presetId: CameraPresetId) {
    const pos = CAMERA_POSITIONS[presetId][mode];
    viewer3DState.setActiveCameraPreset(presetId);
    viewer3DState.snapCameraTo(pos, GRID_CENTER);
  }
</script>

<div class="presets-bar">
  <!-- Learn / Mirror toggle — hidden in dual-wheel mode (not applicable) -->
  {#if !isDualWheel}
    <div class="mode-toggle">
      <button
        class="mode-button"
        class:active={!viewer3DState.mirrorMode}
        onclick={() => handleModeToggle(false)}
        aria-label="Learn mode: same direction"
      >Learn</button>
      <button
        class="mode-button"
        class:active={viewer3DState.mirrorMode}
        onclick={() => handleModeToggle(true)}
        aria-label="Mirror mode: face to face"
      >Mirror</button>
    </div>

    <div class="separator"></div>
  {/if}

  <!-- Camera angle presets -->
  <div class="camera-presets">
    {#each CAMERA_PRESETS as preset}
      <button
        class="preset-button"
        class:active={activeCameraPreset === preset.id}
        onclick={() => handleCameraPreset(preset.id)}
        aria-label={`Camera: ${preset.label}`}
      >{preset.label}</button>
    {/each}
  </div>
</div>

<div class="view-sublabel">
  {#if isDualWheel}
    Dual wheel · viewed from stage right
  {:else}
    {sublabel}
  {/if}
</div>

<style>
  .presets-bar {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0;
    padding: 4px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
  }

  .mode-toggle {
    display: flex;
    gap: 2px;
  }

  .separator {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 4px;
  }

  .camera-presets {
    display: flex;
    gap: 2px;
  }

  .mode-button, .preset-button {
    padding: 6px 11px;
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

  .mode-button:hover, .preset-button:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.08);
  }

  .mode-button.active {
    color: #fff;
    background: rgba(139, 139, 255, 0.2);
    border-color: rgba(139, 139, 255, 0.3);
  }

  .preset-button.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .view-sublabel {
    position: absolute;
    bottom: 52px;
    right: 12px;
    z-index: 10;
    padding: 5px 12px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    pointer-events: none;
    white-space: nowrap;
  }
</style>
