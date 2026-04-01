<script lang="ts">
  /**
   * Viewer3DViewPresets
   *
   * Floating overlay with compact preset buttons for common camera angles.
   * Rendered outside the Threlte Canvas as HTML, communicates with the camera
   * via the viewer-3d context's snapCameraTo callback.
   *
   * Coordinate system reminder:
   *   +X = performer's right
   *   +Y = up
   *   +Z = toward audience (avatar faces +Z at facingAngle=0)
   *
   * "Behind" means camera at -Z, seeing the performer's back (performer's perspective).
   * "Front" means camera at +Z, seeing the performer's face (audience view).
   */

  import { getViewer3DContext } from "../context/viewer-3d-context";

  const viewer3DState = getViewer3DContext();

  type ViewPreset = {
    id: string;
    label: string;
    /** Short description shown when this preset is active */
    sublabel?: string;
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };

  // The grid center in world space: Y=STAGE_LIFT (shoulder height ≈1.56m),
  // Z=gridOffset (0.3m in front of avatar). This is where the three plane
  // discs intersect — the exact rotation center of the prop system.
  // Using 1.55 as a reasonable approximation of STAGE_LIFT.
  const GRID_CENTER = { x: 0, y: 1.55, z: 0.3 };

  const PRESETS: ViewPreset[] = [
    {
      id: "behind",
      label: "Back",
      sublabel: "Performer's view  \u2022  red = right, blue = left",
      position: { x: 0, y: 1.85, z: -2.2 },
      target: GRID_CENTER,
    },
    {
      id: "front",
      label: "Front",
      sublabel: "Audience view",
      position: { x: 0, y: 1.85, z: 2.8 },
      target: GRID_CENTER,
    },
    {
      id: "side",
      label: "Side",
      sublabel: "From performer's right",
      position: { x: 2.5, y: 1.85, z: 0.3 },
      target: GRID_CENTER,
    },
    {
      id: "top",
      label: "Top",
      position: { x: 0, y: 4.5, z: 0.29 },
      target: GRID_CENTER,
    },
    {
      id: "threequarter",
      label: "3/4",
      sublabel: "Isometric behind",
      position: { x: -1.5, y: 3.0, z: -1.7 },
      target: GRID_CENTER,
    },
  ];

  // Track which preset was last clicked. Cleared when the user orbits
  // far enough from any preset position (based on camera snapshot updates).
  let clickedPresetId = $state<string | null>("behind");

  // Check if the current camera position is close to any preset.
  // Uses the persisted camera snapshot which updates after orbit ends.
  const activePresetId = $derived.by(() => {
    const snap = viewer3DState.cameraSnapshot;
    if (!snap) return clickedPresetId;

    const threshold = 0.5; // distance within which we consider "at" a preset
    for (const preset of PRESETS) {
      const dx = snap.position.x - preset.position.x;
      const dy = snap.position.y - preset.position.y;
      const dz = snap.position.z - preset.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < threshold) return preset.id;
    }
    return null; // user orbited away from all presets
  });

  function handlePresetClick(preset: ViewPreset) {
    clickedPresetId = preset.id;
    viewer3DState.snapCameraTo(preset.position, preset.target);
  }
</script>

<div class="view-presets">
  {#each PRESETS as preset}
    <button
      class="preset-button"
      class:active={activePresetId === preset.id}
      onclick={() => handlePresetClick(preset)}
      aria-label={`Camera: ${preset.label}`}
    >
      {preset.label}
    </button>
  {/each}
</div>

{#if activePresetId}
  {@const active = PRESETS.find((p) => p.id === activePresetId)}
  {#if active?.sublabel}
    <div class="view-sublabel">{active.sublabel}</div>
  {/if}
{/if}

<style>
  .view-presets {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
  }

  .preset-button {
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

  .preset-button:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.08);
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
