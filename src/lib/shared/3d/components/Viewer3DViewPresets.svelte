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

  const viewer3DState = getViewer3DContext();

  const GRID_CENTER = { x: 0, y: 1.55, z: 0.3 };

  // Camera positions for each preset, keyed by learning mode.
  // In mirror mode, Z and X flip to look from the opposite side.
  const CAMERA_POSITIONS = {
    main: {
      learn:  { x: 0,    y: 1.85, z: -3.0 },
      mirror: { x: 0,    y: 1.85, z: 3.6 },
    },
    side: {
      learn:  { x: 3.2,  y: 1.85, z: 0.3 },
      mirror: { x: -3.2, y: 1.85, z: 0.3 },
    },
    top: {
      learn:  { x: 0, y: 5.0, z: 0.29 },
      mirror: { x: 0, y: 5.0, z: 0.31 },
    },
    threequarter: {
      learn:  { x: -2.0, y: 3.5, z: -2.2 },
      mirror: { x: 2.0,  y: 3.5, z: 2.5 },
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
      return "Face to face \u2022 match their movements";
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
  <!-- Learn / Mirror toggle -->
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

<div class="view-sublabel">{sublabel}</div>

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
    padding: 5px 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
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
    bottom: 48px;
    right: 12px;
    z-index: 10;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    pointer-events: none;
    white-space: nowrap;
  }
</style>
