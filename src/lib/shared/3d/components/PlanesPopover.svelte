<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import CascadeBadge from "./controls/CascadeBadge.svelte";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  interface Props {
    onSettingChange?: ViewerControlSink;
  }
  let { onSettingChange }: Props = $props();

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const PLANES: { plane: Plane; label: string }[] = [
    { plane: Plane.WALL, label: "Wall" },
    { plane: Plane.WHEEL, label: "Wheel" },
    { plane: Plane.FLOOR, label: "Floor" },
  ];

  const bluePlane = $derived(
    isAllMode
      ? viewer.defaultSettings.customBluePlane
      : (selected?.effectiveBluePlane ?? Plane.WALL)
  );

  const redPlane = $derived(
    isAllMode
      ? viewer.defaultSettings.customRedPlane
      : (selected?.effectiveRedPlane ?? Plane.WALL)
  );

  const isOverridden = $derived(
    !isAllMode && (selected?.hasOverride.planes ?? false)
  );
  const overrideCount = $derived(
    isAllMode ? viewer.overrideCountForCategory("planes") : 0
  );

  function hasHandOnPlane(plane: Plane): boolean {
    return bluePlane === plane || redPlane === plane;
  }

  function isVisible(plane: Plane): boolean {
    return viewer.visiblePlanes.has(plane);
  }

  const hasStepOverrides = $derived(selected?.hasStepOverrides ?? false);

  const isPlaneStateNonDefault = $derived(
    bluePlane !== Plane.WALL ||
      redPlane !== Plane.WALL ||
      hasStepOverrides ||
      viewer.visiblePlanes.size > 0
  );

  function handlePlaneToggleClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    const previous = isVisible(plane);
    viewer.togglePlane(plane);
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_planes",
      `${String(plane).toLowerCase()}_visible`,
      previous,
      !previous
    );
  }

  function handleHandSlotClick(
    e: MouseEvent,
    hand: "blue" | "red",
    plane: Plane
  ) {
    e.stopPropagation();
    const currentPlane = hand === "blue" ? bluePlane : redPlane;
    if (currentPlane === plane) return;

    if (isAllMode) {
      viewer.setDefaultHandPlane(hand, plane);
    } else {
      viewer.setHandPlaneScoped(hand, plane);
    }
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_planes",
      `${hand}_plane`,
      currentPlane,
      plane
    );
  }

  function handleResetPlanesClick(e: MouseEvent) {
    e.stopPropagation();
    if (isAllMode) {
      viewer.setDefaultHandPlane("blue", Plane.WALL);
      viewer.setDefaultHandPlane("red", Plane.WALL);
      viewer.hideAllPlanes();
    } else if (selected) {
      selected.resetPlanes();
      for (const p of viewer.scopedPerformers()) {
        p.clearBeatPlaneOverrides();
      }
    }
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_planes",
      isAllMode ? "reset_all" : "reset_performer",
      false,
      true
    );
  }

  function resetAllOverrides(): void {
    viewer.resetAllPerformersPlanes();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_planes",
      "reset_all_overrides",
      false,
      true
    );
  }

  function resetSelectedPlanes(): void {
    selected?.resetPlanes();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_planes",
      "reset_performer_override",
      false,
      true
    );
  }

  function toggleGridLabels(e: MouseEvent): void {
    e.stopPropagation();
    const previous = viewer.showGridLabels;
    viewer.toggleGridLabels();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_planes",
      "location_labels",
      previous,
      !previous
    );
  }
</script>

{#if isAllMode && overrideCount > 0}
  <CascadeBadge
    mode="overrides"
    {overrideCount}
    categoryLabel="planes"
    onReset={resetAllOverrides}
  />
{:else if !isAllMode && isOverridden}
  <CascadeBadge mode="custom" onReset={resetSelectedPlanes} />
{:else if !isAllMode}
  <CascadeBadge mode="default" />
{/if}

<div class="plane-matrix">
  {#each PLANES as { plane, label }}
    {@const handAssigned = hasHandOnPlane(plane)}
    {@const visible = isVisible(plane)}
    {@const color = PLANE_COLORS[plane]}
    <div
      class="plane-row"
      class:with-hand={handAssigned}
      class:hidden-row={!visible}
    >
      <div class="plane-left">
        <button
          class="plane-toggle"
          class:visible
          class:hidden={!visible}
          style="--dot-color: {color};"
          onclick={(e) => handlePlaneToggleClick(e, plane)}
          aria-pressed={visible}
          aria-label={`${label} plane - ${visible ? "visible, click to hide" : "hidden, click to show"}`}
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

<div class="label-toggle-row">
  <span class="toggle-label">Location labels</span>
  <button
    class="label-toggle"
    class:active={viewer.showGridLabels}
    onclick={toggleGridLabels}
    aria-pressed={viewer.showGridLabels}
    aria-label="Toggle grid location labels"
  >
    <span class="toggle-track">
      <span class="toggle-thumb"></span>
    </span>
  </button>
</div>

{#if isPlaneStateNonDefault}
  <div class="planes-footer">
    <button
      class="reset-btn"
      class:with-overrides={hasStepOverrides}
      onclick={handleResetPlanesClick}
      aria-label={hasStepOverrides
        ? "Reset all planes and clear step overrides"
        : "Reset all planes"}
      title={hasStepOverrides
        ? "Reset all planes and clear step overrides"
        : "Reset all planes"}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
      </svg>
      Reset
      {#if hasStepOverrides}
        <span class="override-badge" aria-hidden="true"></span>
      {/if}
    </button>
  </div>
{/if}

<style>
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

  .plane-toggle:hover {
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

  .hand-slot.blue {
    border-color: rgba(74, 144, 217, 0.4);
  }
  .hand-slot.red {
    border-color: rgba(217, 74, 74, 0.4);
  }

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

  .planes-footer {
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

  .label-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    margin-top: 6px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .toggle-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .label-toggle {
    position: relative;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .toggle-track {
    display: block;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    transition: background 180ms ease;
    position: relative;
  }

  .label-toggle.active .toggle-track {
    background: rgba(139, 92, 246, 0.7);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    transition: transform 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .label-toggle.active .toggle-thumb {
    transform: translateX(16px);
  }

  .reset-btn.with-overrides .override-badge {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--semantic-warning, #f59e0b);
    border: 1.5px solid rgba(20, 22, 32, 1);
  }
</style>
