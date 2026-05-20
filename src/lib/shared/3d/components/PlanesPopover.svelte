<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "planes");
  const avatarState = $derived(viewer.performerManager.performers[0] ?? null);

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  const bluePlane = $derived(avatarState?.customBluePlane ?? Plane.WALL);
  const redPlane = $derived(avatarState?.customRedPlane ?? Plane.WALL);

  function isImplicit(plane: Plane): boolean {
    return bluePlane === plane || redPlane === plane;
  }

  function isForceShown(plane: Plane): boolean {
    return viewer.visiblePlanes.has(plane) && !isImplicit(plane);
  }

  function isVisible(plane: Plane): boolean {
    return isImplicit(plane) || isForceShown(plane);
  }

  const isPlaneStateNonDefault = $derived(
    (avatarState?.customBluePlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.customRedPlane ?? Plane.WALL) !== Plane.WALL ||
    (avatarState?.hasStepOverrides ?? false) ||
    PLANES.some(({ plane }) => isForceShown(plane))
  );

  const hasStepOverrides = $derived(avatarState?.hasStepOverrides ?? false);

  function handlePlaneToggleClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    if (isImplicit(plane)) return;
    viewer.togglePlane(plane);
  }

  function handleHandSlotClick(e: MouseEvent, hand: "blue" | "red", plane: Plane) {
    e.stopPropagation();
    if (!avatarState) return;
    const currentPlane = hand === "blue" ? bluePlane : redPlane;
    if (currentPlane === plane) return;
    viewer.setHandPlaneScoped(hand, plane);
  }

  function handleResetPlanesClick(e: MouseEvent) {
    e.stopPropagation();
    if (!avatarState) return;
    viewer.setHandPlaneScoped("blue", Plane.WALL);
    viewer.setHandPlaneScoped("red", Plane.WALL);
    for (const p of viewer.scopedPerformers()) {
      p.clearBeatPlaneOverrides();
    }
    for (const { plane } of PLANES) {
      if (isForceShown(plane)) {
        viewer.togglePlane(plane);
      }
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="planes-popover"
    role="dialog"
    aria-label="Plane visibility"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
    out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">Planes</span>
    </div>
    <div class="pop-body">
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
                aria-label={`${label} plane - ${implicit ? 'locked visible, hand assigned' : (visible ? 'force-shown, click to hide' : 'hidden, click to show')}`}
              >
                <i
                  class="plane-eye {visible ? 'fas fa-eye' : 'fas fa-eye-slash'}"
                  aria-hidden="true"
                ></i>
              </button>
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

      {#if isPlaneStateNonDefault}
        <div class="pop-footer">
          <button
            class="reset-btn"
            class:with-overrides={hasStepOverrides}
            onclick={handleResetPlanesClick}
            aria-label={hasStepOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
            title={hasStepOverrides ? 'Reset all planes and clear beat overrides' : 'Reset all planes'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
            </svg>
            Reset
            {#if hasStepOverrides}
              <span class="override-badge" aria-hidden="true"></span>
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .planes-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 320px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }

  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .pop-title {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.88);
    letter-spacing: 0.03em;
  }

  .pop-body {
    padding: 12px 14px 14px;
  }

  .plane-matrix {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .plane-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    min-height: 44px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .plane-row:hover {
    background: rgba(0, 0, 0, 0.45);
    border-color: rgba(255, 255, 255, 0.12);
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
    gap: 8px;
    flex-shrink: 0;
  }

  .plane-toggle {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
    background: transparent;
    flex-shrink: 0;
    padding: 0;
    color: #fff;
  }

  .plane-eye {
    font-size: 12px;
    line-height: 1;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
  }

  .plane-toggle.visible {
    background: var(--dot-color);
    border-color: var(--dot-color);
    box-shadow: 0 0 14px color-mix(in srgb, var(--dot-color) 45%, transparent);
    color: #fff;
  }

  .plane-toggle.hidden {
    background: transparent;
    border-color: color-mix(in srgb, var(--dot-color) 50%, transparent);
    color: var(--dot-color);
  }

  .plane-toggle.implicit {
    cursor: default;
  }

  .plane-toggle:hover:not(.implicit) {
    transform: scale(1.1);
  }

  .plane-label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.88);
  }

  .plane-row.hidden-row .plane-label {
    color: rgba(255, 255, 255, 0.55);
  }

  .hand-slot {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 2px dashed;
    cursor: pointer;
    background: transparent;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
    flex-shrink: 0;
    padding: 0;
  }

  .hand-slot.blue { border-color: rgba(74, 144, 217, 0.4); }
  .hand-slot.red { border-color: rgba(217, 74, 74, 0.4); }

  .hand-slot:hover:not(.filled).blue {
    border-color: rgba(74, 144, 217, 0.7);
    box-shadow: 0 0 10px rgba(74, 144, 217, 0.2);
  }

  .hand-slot:hover:not(.filled).red {
    border-color: rgba(217, 74, 74, 0.7);
    box-shadow: 0 0 10px rgba(217, 74, 74, 0.2);
  }

  .hand-slot.filled.blue {
    background: #4a90d9;
    border: 2px solid #4a90d9;
    box-shadow: 0 0 12px rgba(74, 144, 217, 0.5);
  }

  .hand-slot.filled.red {
    background: #d94a4a;
    border: 2px solid #d94a4a;
    box-shadow: 0 0 12px rgba(217, 74, 74, 0.5);
  }

  .pop-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    min-height: 30px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .reset-btn:hover {
    color: rgba(255, 255, 255, 0.95);
    border-color: rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  .reset-btn.with-overrides .override-badge {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f59e0b;
    border: 1.5px solid rgba(20, 22, 32, 1);
  }
</style>
