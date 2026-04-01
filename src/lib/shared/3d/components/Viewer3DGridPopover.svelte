<script lang="ts">
  /**
   * Viewer3DGridPopover
   *
   * Replaces the simple Grid toggle button with a small floating popover that
   * lets the user pick which grid planes to show. The button itself acts as an
   * on/off indicator — lit up when any plane is visible. Clicking it opens the
   * plane picker positioned directly below the button.
   *
   * Plane colours match the Grid3D/GridPlane colours so the UI stays consistent
   * with what you see in the scene.
   */

  import { Plane, PLANE_COLORS, PLANE_LABELS } from "../domain/enums/Plane";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    sequenceData: SequenceData | null;
  }

  let { sequenceData }: Props = $props();

  const viewer3DState = getViewer3DContext();

  let open = $state(false);
  let buttonEl = $state<HTMLButtonElement | null>(null);

  // The three planes in display order — wall first because it's the active plane
  // for every current sequence.
  const PLANES: Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];

  // Short labels without "Plane" suffix to keep the popover compact.
  const SHORT_LABELS: Record<Plane, string> = {
    [Plane.WALL]: "Wall",
    [Plane.WHEEL]: "Wheel",
    [Plane.FLOOR]: "Floor",
  };

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function handlePlaneClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    viewer3DState.togglePlane(plane);
  }

  function handleAll(e: MouseEvent) {
    e.stopPropagation();
    viewer3DState.showAllPlanes();
  }

  function handleNone(e: MouseEvent) {
    e.stopPropagation();
    viewer3DState.hideAllPlanes();
  }

  // Close the popover when anything outside it is clicked.
  function handleOutsideClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (buttonEl && !buttonEl.closest(".grid-popover-root")?.contains(target)) {
      open = false;
    }
  }

  // Whether any plane is currently visible — drives the "active" state on the button.
  const anyVisible = $derived(viewer3DState.visiblePlanes.size > 0);
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="grid-popover-root">
  <!-- Trigger button: matches the existing exit-3d-button style family -->
  <button
    bind:this={buttonEl}
    class="grid-trigger"
    class:active={anyVisible}
    onclick={toggleOpen}
    aria-label={anyVisible ? "Grid planes active — click to adjust" : "Show grid planes"}
    aria-expanded={open}
    aria-haspopup="true"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
    Grid
  </button>

  <!-- Popover panel -->
  {#if open}
    <div
      class="grid-popover"
      role="dialog"
      aria-label="Grid plane visibility"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Quick actions row -->
      <div class="quick-row">
        <button class="quick-btn" onclick={handleAll}>All</button>
        <button class="quick-btn" onclick={handleNone}>None</button>
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Per-plane toggles -->
      <ul class="plane-list">
        {#each PLANES as plane}
          {@const isVisible = viewer3DState.visiblePlanes.has(plane)}
          {@const color = PLANE_COLORS[plane]}
          <li>
            <button
              class="plane-row"
              class:plane-active={isVisible}
              onclick={(e) => handlePlaneClick(e, plane)}
              aria-pressed={isVisible}
              aria-label="{PLANE_LABELS[plane]} — {isVisible ? 'visible' : 'hidden'}"
            >
              <!-- Colour swatch -->
              <span
                class="plane-dot"
                style="background: {color}; box-shadow: 0 0 6px {color}60;"
              ></span>

              <!-- Label -->
              <span class="plane-label">{SHORT_LABELS[plane]}</span>

              <!-- Toggle indicator -->
              <span class="plane-toggle" class:toggle-on={isVisible}>
                {#if isVisible}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                {/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .grid-popover-root {
    position: relative;
  }

  /* ── Trigger button ── */
  .grid-trigger {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .grid-trigger:hover {
    background: rgba(0, 0, 0, 0.7);
    color: rgba(255, 255, 255, 0.9);
  }
  .grid-trigger.active {
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.1);
  }

  /* ── Popover panel ── */
  .grid-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    min-width: 156px;
    border-radius: 10px;
    background: rgba(14, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ── Quick-action row ── */
  .quick-row {
    display: flex;
    gap: 4px;
  }
  .quick-btn {
    flex: 1;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    text-align: center;
  }
  .quick-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.9);
  }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 0;
  }

  /* ── Plane list ── */
  .plane-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .plane-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
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

  /* Colour swatch dot */
  .plane-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Label stretches to fill remaining space */
  .plane-label {
    flex: 1;
  }

  /* Check-mark / empty slot */
  .plane-toggle {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
  .plane-toggle.toggle-on {
    color: #a3e635;
  }
</style>
