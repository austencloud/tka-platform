<script lang="ts">
  /**
   * Viewer3DGearPopover
   *
   * Single gear icon for half-screen 3D mode. Opens a popover with:
   * 1. Camera presets (Main, Front, Side, Top, 3/4)
   * 2. Grid plane toggles (Wall, Wheel, Floor)
   */

  import { Plane, PLANE_COLORS } from "../domain/enums/Plane";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const viewer3DState = getViewer3DContext();

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handlePlaneClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    viewer3DState.togglePlane(plane);
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      open = false;
    }
  }

  const anyPlaneVisible = $derived(viewer3DState.visiblePlanes.size > 0);
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="gear-root" bind:this={rootEl}>
  <button
    class="gear-button"
    class:active={open}
    onclick={toggleOpen}
    aria-label="3D viewer settings"
    aria-expanded={open}
    aria-haspopup="true"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  </button>

  {#if open}
    <div
      class="gear-popover"
      role="dialog"
      aria-label="3D viewer settings"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
    >
      <!-- Camera presets -->
      <div class="section">
        <div class="section-label">Camera</div>
        <Viewer3DViewPresets compact />
      </div>

      <div class="divider"></div>

      <!-- Grid planes -->
      <div class="section">
        <div class="section-label">Grid Planes</div>
        <div class="plane-list">
          {#each PLANES as { plane, label }}
            {@const isVisible = viewer3DState.visiblePlanes.has(plane)}
            {@const color = PLANE_COLORS[plane]}
            <button
              class="plane-row"
              class:plane-active={isVisible}
              onclick={(e) => handlePlaneClick(e, plane)}
              aria-pressed={isVisible}
              aria-label="{label} plane — {isVisible ? 'visible' : 'hidden'}"
            >
              <span class="plane-dot" style="background: {color}; box-shadow: 0 0 4px {color}60;"></span>
              <span class="plane-label">{label}</span>
              {#if isVisible}
                <svg class="plane-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3e635" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .gear-root {
    position: relative;
  }

  .gear-button {
    width: var(--min-touch-target-compact, 32px);
    height: var(--min-touch-target-compact, 32px);
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }

  .gear-button:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.9);
  }

  .gear-button.active {
    background: rgba(139, 139, 255, 0.2);
    border-color: rgba(139, 139, 255, 0.3);
    color: #fff;
  }

  .gear-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    min-width: 200px;
    border-radius: 10px;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    padding: 10px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .section-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.35);
    font-weight: 600;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 8px 0;
  }

  .plane-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .plane-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 5px;
    background: transparent;
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    text-align: left;
  }

  .plane-row:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .plane-row.plane-active {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .plane-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .plane-label {
    flex: 1;
  }

  .plane-check {
    flex-shrink: 0;
  }
</style>
