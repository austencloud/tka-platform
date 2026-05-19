<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import PerformerChipStrip from "./controls/PerformerChipStrip.svelte";
  import { createViewer3DKeyboardHandler } from "../keyboard/Viewer3DKeyboardHandler";
  import { onMount } from "svelte";
  import SceneFeatureTiles from "../scene-features/components/SceneFeatureTiles.svelte";
  import { tryGetSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { inchesToCm } from "@austencloud/scene-3d";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import type { OceanVariant } from "../environments/domain/enums/environment-enums";

  const hasSceneFeatures = tryGetSceneFeatureContext() !== undefined;
  const isOceanActive = $derived(settingsService.settings.backgroundType === BackgroundType.DEEP_OCEAN);
  const OCEAN_VIBES: { id: OceanVariant; label: string; icon: string }[] = [
    { id: "abyss", label: "Abyss", icon: "fa-water" },
    { id: "reef", label: "Reef", icon: "fa-fish" },
    { id: "mystical", label: "Mystical", icon: "fa-wand-sparkles" },
    { id: "cinematic", label: "Cinematic", icon: "fa-film" },
  ];

  interface Tab { id: "camera" | "planes" | "scene"; label: string; icon: string; }

  const TABS: Tab[] = [
    { id: "camera", label: "Camera", icon: "fa-video" },
    { id: "planes", label: "Planes", icon: "fa-layer-group" },
    { id: "scene",  label: "Scene",  icon: "fa-mountain-sun" },
  ];

  const viewer3DState = getViewer3DContext();
  const open = $derived(viewer3DState.activePopover === "gear");
  let activeTab = $state<Tab["id"]>("camera");

  onMount(() => {
    return createViewer3DKeyboardHandler({
      undo: () => viewer3DState.undo(),
      redo: () => viewer3DState.redo(),
    });
  });

  const avatarState = $derived(viewer3DState.performerManager.performers[0] ?? null);

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
    return viewer3DState.visiblePlanes.has(plane) && !isImplicit(plane);
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

  function selectTab(e: MouseEvent, tabId: Tab["id"]) {
    e.stopPropagation();
    activeTab = tabId;
  }

  function handlePlaneToggleClick(e: MouseEvent, plane: Plane) {
    e.stopPropagation();
    if (isImplicit(plane)) return;
    viewer3DState.togglePlane(plane);
  }

  function handleHandSlotClick(e: MouseEvent, hand: "blue" | "red", plane: Plane) {
    e.stopPropagation();
    if (!avatarState) return;
    const currentPlane = hand === "blue" ? bluePlane : redPlane;
    if (currentPlane === plane) return;
    viewer3DState.setHandPlaneScoped(hand, plane);
  }

  function handleResetPlanesClick(e: MouseEvent) {
    e.stopPropagation();
    if (!avatarState) return;
    viewer3DState.setHandPlaneScoped("blue", Plane.WALL);
    viewer3DState.setHandPlaneScoped("red", Plane.WALL);
    for (const p of viewer3DState.scopedPerformers()) {
      p.clearBeatPlaneOverrides();
    }
    for (const { plane } of PLANES) {
      if (isForceShown(plane)) {
        viewer3DState.togglePlane(plane);
      }
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="gear-popover"
    role="dialog"
    aria-label="3D viewer settings"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer3DState.closePopover(); }}
    in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
    out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <PerformerChipStrip />
    </div>

    <div class="pop-body">
      <div class="tab-bar" role="tablist">
        {#each TABS as tab}
          <button
            class="tab-btn"
            class:active={activeTab === tab.id}
            onclick={(e) => selectTab(e, tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="tab-panel-{tab.id}"
            title={tab.label}
          >
            <i class="fas {tab.icon}"></i>
            <span>{tab.label}</span>
          </button>
        {/each}
      </div>

      {#if activeTab === "camera"}
        <div class="tab-panel" id="tab-panel-camera" role="tabpanel">
          <Viewer3DViewPresets grid />
        </div>
      {/if}

      {#if activeTab === "planes"}
        <div class="tab-panel" id="tab-panel-planes" role="tabpanel">
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
            <div class="tab-footer">
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
      {/if}

      {#if activeTab === "scene"}
        <div class="tab-panel" id="tab-panel-scene" role="tabpanel">
          {#if hasSceneFeatures}
            <SceneFeatureTiles />
          {/if}

          {#if isOceanActive}
            <div class="scene-control">
              <div class="scene-control-header">
                <span class="scene-control-label">Ocean vibe</span>
              </div>
              <div class="preset-row">
                {#each OCEAN_VIBES as vibe}
                  <button
                    class="preset-btn"
                    class:active={viewer3DState.oceanVariant === vibe.id}
                    onclick={(e) => { e.stopPropagation(); viewer3DState.setOceanVariant(vibe.id); }}
                    aria-pressed={viewer3DState.oceanVariant === vibe.id}
                  >
                    <i class="fas {vibe.icon}" aria-hidden="true" style="margin-right:4px;font-size:10px"></i>
                    {vibe.label}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <div class="scene-control">
            <div class="scene-control-header">
              <span class="scene-control-label">Prop size</span>
              <span class="scene-control-value">{userProportionsState.staffLengthDisplay}</span>
            </div>
            <input
              type="range"
              class="scene-slider"
              min={inchesToCm(24)}
              max={inchesToCm(60)}
              step="1"
              value={userProportionsState.staffLengthCm}
              oninput={(e) => userProportionsState.setStaffLengthCm(Number(e.currentTarget.value))}
              aria-label="Prop size"
            />
          </div>

          <div class="scene-control">
            <div class="scene-control-header">
              <span class="scene-control-label">Body freedom</span>
              <span class="scene-control-value">{userProportionsState.bodyFreedomDisplay}</span>
            </div>
            <div class="preset-row">
              <button
                class="preset-btn"
                class:active={userProportionsState.bodyFreedom <= 0.01}
                onclick={(e) => { e.stopPropagation(); userProportionsState.setBodyFreedom(0); }}
                aria-pressed={userProportionsState.bodyFreedom <= 0.01}
              >Square</button>
              <button
                class="preset-btn"
                class:active={Math.abs(userProportionsState.bodyFreedom - 0.5) < 0.01}
                onclick={(e) => { e.stopPropagation(); userProportionsState.setBodyFreedom(0.5); }}
                aria-pressed={Math.abs(userProportionsState.bodyFreedom - 0.5) < 0.01}
              >Natural</button>
              <button
                class="preset-btn"
                class:active={userProportionsState.bodyFreedom >= 0.99}
                onclick={(e) => { e.stopPropagation(); userProportionsState.setBodyFreedom(1); }}
                aria-pressed={userProportionsState.bodyFreedom >= 0.99}
              >Expressive</button>
            </div>
            <input
              type="range"
              class="scene-slider"
              min="0"
              max="1"
              step="0.01"
              value={userProportionsState.bodyFreedom}
              oninput={(e) => userProportionsState.setBodyFreedom(Number(e.currentTarget.value))}
              aria-label="Body freedom"
            />
          </div>

          <div class="scene-control perf-toggle-row">
            <button
              class="perf-toggle-btn"
              aria-pressed={viewer3DState.showPerf}
              onclick={(e) => { e.stopPropagation(); viewer3DState.togglePerf(); }}
            >
              <i class="fas fa-chart-line" aria-hidden="true"></i>
              <span>Performance</span>
              <span class="perf-indicator" class:on={viewer3DState.showPerf}>
                {viewer3DState.showPerf ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>
      {/if}
    </div>

    <button
      class="bridge-btn"
      onclick={(e) => { e.stopPropagation(); console.log("[stub] Stage destination not yet built"); }}
    >
      <span class="bridge-text">
        <span class="bridge-title">Stage this scene</span>
        <span class="bridge-sub">Multi-sequence · timeline · audio</span>
      </span>
      <span class="bridge-arrow"><i class="fas fa-arrow-right"></i></span>
    </button>
  </div>
{/if}

<style>
  .gear-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 340px;
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

  .pop-body {
    padding: 12px 14px 14px;
  }

  /* --- Tab bar --- */
  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 12px;
  }

  .tab-btn {
    flex: 1;
    padding: 8px 10px;
    min-height: var(--min-touch-target, 44px);
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.42);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .tab-btn i {
    font-size: 12px;
    opacity: 0.6;
    transition: opacity 180ms;
  }

  .tab-btn:hover:not(:disabled):not(.active) {
    color: rgba(255, 255, 255, 0.75);
    background: rgba(255, 255, 255, 0.06);
  }

  .tab-btn:hover:not(:disabled):not(.active) i {
    opacity: 0.8;
  }

  .tab-btn.active {
    background: color-mix(in srgb, #4a9eff 15%, transparent);
    border-color: color-mix(in srgb, #4a9eff 35%, transparent);
    color: #cfe4ff;
    box-shadow: 0 2px 8px color-mix(in srgb, #4a9eff 15%, transparent);
  }

  .tab-btn.active i {
    opacity: 1;
    color: #8fc3ff;
  }

  .tab-btn:disabled {
    color: rgba(255, 255, 255, 0.2);
    cursor: not-allowed;
  }

  /* --- Tab panels --- */
  .tab-panel {
    padding: 2px 0 0 0;
  }

  /* --- Plane matrix --- */
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

  /* --- Tab footer --- */
  .tab-footer {
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

  /* --- Scene controls --- */
  .scene-control {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: border-color 180ms;
  }

  .scene-control:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .scene-control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .scene-control-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.72);
  }

  .scene-control-value {
    font-size: 12px;
    font-weight: 700;
    color: #cfe4ff;
    font-variant-numeric: tabular-nums;
  }

  .scene-slider {
    width: 100%;
    height: 6px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    transition: background 180ms;
  }

  .scene-slider:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .scene-slider::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
    transition: box-shadow 180ms, transform 180ms;
  }

  .scene-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 16px rgba(96, 165, 250, 0.55);
    transform: scale(1.1);
  }

  .scene-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2.5px solid rgba(20, 22, 32, 1);
    cursor: pointer;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.35);
  }

  .preset-row {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }

  .preset-btn {
    flex: 1;
    padding: 6px 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .preset-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .preset-btn.active {
    background: color-mix(in srgb, #60a5fa 22%, transparent);
    border-color: color-mix(in srgb, #60a5fa 50%, transparent);
    color: #cfe4ff;
    box-shadow: 0 2px 10px color-mix(in srgb, #60a5fa 20%, transparent);
  }

  /* --- Perf toggle --- */
  .perf-toggle-row {
    padding: 0 !important;
  }

  .perf-toggle-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .perf-toggle-btn:hover {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.45);
  }

  .perf-toggle-btn[aria-pressed="true"] {
    border-color: color-mix(in srgb, #4ade80 35%, transparent);
    background: color-mix(in srgb, #4ade80 8%, transparent);
  }

  .perf-toggle-btn i {
    font-size: 14px;
    opacity: 0.6;
  }

  .perf-toggle-btn[aria-pressed="true"] i {
    color: #4ade80;
    opacity: 1;
  }

  .perf-toggle-btn span:first-of-type {
    flex: 1;
    text-align: left;
  }

  .perf-indicator {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.4);
  }

  .perf-indicator.on {
    background: color-mix(in srgb, #4ade80 20%, transparent);
    color: #4ade80;
  }

  /* --- Bridge CTA --- */
  .bridge-btn {
    margin: 10px 14px 14px;
    min-height: var(--min-touch-target);
    padding: 14px 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #a855f7 18%, transparent),
      color-mix(in srgb, #4a9eff 18%, transparent)
    );
    border: 1px solid color-mix(in srgb, #a855f7 40%, transparent);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    color: rgba(255, 255, 255, 0.95);
    cursor: pointer;
    width: calc(100% - 28px);
    text-align: left;
    transition: all 220ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .bridge-btn:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
    box-shadow: 0 6px 24px color-mix(in srgb, #a855f7 25%, transparent);
  }

  .bridge-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bridge-title {
    font-size: 13px;
    font-weight: 700;
  }

  .bridge-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.42);
  }

  .bridge-arrow {
    color: #c89aff;
    font-size: 16px;
    transition: transform 220ms;
  }

  .bridge-btn:hover .bridge-arrow {
    transform: translateX(3px);
  }
</style>
