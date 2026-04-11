<script lang="ts">
  /**
   * Viewer3DGearPopover
   *
   * Single gear icon for the sequence-viewer 3D popover. Contains:
   * 1. Camera presets (2×3 grid)
   * 2. Unified Planes matrix — one row per plane, showing which hands are
   *    on it and whether it's visible. The plane color dot doubles as the
   *    visibility toggle. Hand slots on the right are drop targets for
   *    assigning each hand to a plane.
   *
   * Sequence-wide only — per-beat plane overrides are not editable here.
   * PlaneMode is derived from the hand assignments in setHandPlane.
   */

  import { Plane, PLANE_COLORS } from "../domain/enums/Plane";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const viewer3DState = getViewer3DContext();
  const avatarState = $derived(viewer3DState.avatarState);

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  // Sequence-wide hand plane assignments (falls back to Wall if no avatar)
  const bluePlane = $derived(avatarState?.customBluePlane ?? Plane.WALL);
  const redPlane = $derived(avatarState?.customRedPlane ?? Plane.WALL);

  // A plane is "implicit" when a hand is on it — visibility is locked on
  function isImplicit(plane: Plane): boolean {
    return bluePlane === plane || redPlane === plane;
  }

  // A plane is "force-shown" when it's in visiblePlanes but no hand is on it
  function isForceShown(plane: Plane): boolean {
    return viewer3DState.visiblePlanes.has(plane) && !isImplicit(plane);
  }

  // A plane is visually "visible" if it's either implicit or force-shown
  function isVisible(plane: Plane): boolean {
    return isImplicit(plane) || isForceShown(plane);
  }

  // Reset is only offered when any state deviates from defaults
  const isNonDefault = $derived(
    (avatarState?.customBluePlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.customRedPlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.hasBeatOverrides ?? false) ||
    PLANES.some(({ plane }) => isForceShown(plane))
  );

  const hasBeatOverrides = $derived(avatarState?.hasBeatOverrides ?? false);

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handlePlaneToggleClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    // Locked when a hand is on the plane
    if (isImplicit(plane)) return;
    viewer3DState.togglePlane(plane);
  }

  function handleHandSlotClick(e: MouseEvent, hand: "blue" | "red", plane: Plane) {
    e.stopPropagation();
    if (!avatarState) return;
    const currentPlane = hand === "blue" ? bluePlane : redPlane;
    // No-op if this hand is already on this plane
    if (currentPlane === plane) return;
    avatarState.setHandPlane(hand, plane);
  }

  function handleResetClick(e: MouseEvent) {
    e.stopPropagation();
    if (!avatarState) return;
    // Reset sequence-wide planes to Wall
    avatarState.setHandPlane("blue", Plane.WALL);
    avatarState.setHandPlane("red", Plane.WALL);
    // Clear any per-beat overrides that exist
    avatarState.clearBeatPlaneOverrides();
    // Clear any force-shown planes
    for (const { plane } of PLANES) {
      if (isForceShown(plane)) {
        viewer3DState.togglePlane(plane);
      }
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      open = false;
    }
  }
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
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
      in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
      out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <!-- Camera presets -->
      <div class="section">
        <div class="section-label">Camera</div>
        <Viewer3DViewPresets grid />
      </div>

      <div class="divider"></div>

      <!-- Unified Planes matrix -->
      <div class="section">
        <div class="section-header">
          <div class="section-label">Planes</div>
          {#if isNonDefault}
            <button
              class="reset-btn"
              class:with-overrides={hasBeatOverrides}
              onclick={handleResetClick}
              aria-label={hasBeatOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
              title={hasBeatOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
              </svg>
              {#if hasBeatOverrides}
                <span class="override-badge" aria-hidden="true"></span>
              {/if}
            </button>
          {/if}
        </div>
        <div class="plane-matrix">
          {#each PLANES as { plane, label }}
            {@const implicit = isImplicit(plane)}
            {@const visible = isVisible(plane)}
            {@const color = PLANE_COLORS[plane]}
            <div
              class="plane-row"
              class:with-hand={implicit}
              class:hidden-row={!visible}
            >
              <div class="plane-left">
                <button
                  class="plane-toggle"
                  class:visible
                  class:hidden={!visible}
                  class:implicit
                  style="--dot-color: {color};"
                  onclick={(e) => handlePlaneToggleClick(e, plane)}
                  aria-pressed={visible}
                  aria-disabled={implicit}
                  aria-label={`${label} plane — ${implicit ? 'locked visible, hand assigned' : (visible ? 'force-shown, click to hide' : 'hidden, click to show')}`}
                ></button>
                <span class="plane-label">{label}</span>
              </div>
              <div class="plane-right">
                <button
                  class="hand-slot blue"
                  class:filled={bluePlane === plane}
                  onclick={(e) => handleHandSlotClick(e, "blue", plane)}
                  aria-pressed={bluePlane === plane}
                  aria-label={`Blue hand on ${label}`}
                ></button>
                <button
                  class="hand-slot red"
                  class:filled={redPlane === plane}
                  onclick={(e) => handleHandSlotClick(e, "red", plane)}
                  aria-pressed={redPlane === plane}
                  aria-label={`Red hand on ${label}`}
                ></button>
              </div>
            </div>
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
    width: 36px;
    height: 36px;
    border-radius: 50%;
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
    width: 288px;
    border-radius: 10px;
    transform-origin: top right;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    padding: 12px;
  }

  .section {
    display: flex;
    flex-direction: column;
  }

  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
    margin-bottom: 6px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    min-height: 20px;
  }

  .section-header .section-label {
    margin-bottom: 0;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 12px 0 10px 0;
  }

  .plane-matrix {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .plane-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 10px;
    min-height: 40px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .plane-row.with-hand {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .plane-row.hidden-row {
    opacity: 0.55;
  }

  .plane-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .plane-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* Plane toggle — round 32px color dot that doubles as visibility control */
  .plane-toggle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    background: transparent;
    flex-shrink: 0;
    padding: 0;
  }

  .plane-toggle.visible {
    background: var(--dot-color);
    border-color: var(--dot-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .plane-toggle.hidden {
    background: transparent;
    border-color: color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .plane-toggle.implicit {
    cursor: default;
  }

  .plane-toggle.implicit::after {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.65);
  }

  .plane-toggle:hover:not(.implicit) {
    transform: scale(1.08);
  }

  .plane-label {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.88);
  }

  .plane-row.hidden-row .plane-label {
    color: rgba(255, 255, 255, 0.55);
  }

  /* Hand slots — 32px round dashed/filled circles */
  .hand-slot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px dashed;
    cursor: pointer;
    background: transparent;
    transition: border-color 0.15s ease;
    flex-shrink: 0;
    padding: 0;
  }

  .hand-slot.blue { border-color: rgba(74, 144, 217, 0.4); }
  .hand-slot.red { border-color: rgba(217, 74, 74, 0.4); }

  .hand-slot.filled.blue {
    background: #4a90d9;
    border: 2px solid #4a90d9;
    box-shadow: 0 0 10px rgba(74, 144, 217, 0.6);
  }

  .hand-slot.filled.red {
    background: #d94a4a;
    border: 2px solid #d94a4a;
    box-shadow: 0 0 10px rgba(217, 74, 74, 0.6);
  }

  .hand-slot:hover:not(.filled) {
    border-color: rgba(255, 255, 255, 0.5);
  }

  /* Reset button — lives in the Planes section header, top-right.
     Only rendered when state is non-default. */
  .reset-btn {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    position: relative;
    transition: color 0.15s ease;
  }

  .reset-btn:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .reset-btn.with-overrides .override-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f59e0b;
    border: 1.5px solid rgba(14, 14, 24, 1);
  }
</style>
