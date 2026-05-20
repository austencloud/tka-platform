<script lang="ts">
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";
  import SceneFeatureTiles from "../scene-features/components/SceneFeatureTiles.svelte";
  import { tryGetSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import { userProportionsState, inchesToCm } from "@austencloud/scene-3d";
  import type { OceanVariant } from "../environments/domain/enums/environment-enums";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "scene");
  const currentBg = $derived(settingsService.settings.backgroundType);
  const hasSceneFeatures = tryGetSceneFeatureContext() !== undefined;
  const isOceanActive = $derived(currentBg === BackgroundType.DEEP_OCEAN);

  const OCEAN_VIBES: { id: OceanVariant; label: string; icon: string }[] = [
    { id: "abyss", label: "Abyss", icon: "fa-water" },
    { id: "reef", label: "Reef", icon: "fa-fish" },
    { id: "mystical", label: "Mystical", icon: "fa-wand-sparkles" },
    { id: "cinematic", label: "Cinematic", icon: "fa-film" },
  ];

  function selectScene(e: MouseEvent, type: BackgroundType) {
    e.stopPropagation();
    settingsService.updateSetting("backgroundType", type);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="scene-popover"
    role="dialog"
    aria-label="Scene settings"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
    out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">Scene</span>
    </div>

    <div class="pop-body">
      <div class="scene-grid">
        {#each ANIMATED_BACKGROUNDS as bg}
          <button
            class="scene-tile"
            class:active={currentBg === bg.type}
            onclick={(e) => selectScene(e, bg.type)}
            aria-pressed={currentBg === bg.type}
            aria-label={bg.label}
            title={bg.label}
          >
            <i class="fas {bg.icon}" aria-hidden="true"></i>
            <span class="tile-label">{bg.label}</span>
          </button>
        {/each}
      </div>

      {#if hasSceneFeatures}
        <div class="section-divider"></div>
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
                class:active={viewer.oceanVariant === vibe.id}
                onclick={(e) => { e.stopPropagation(); viewer.setOceanVariant(vibe.id); }}
                aria-pressed={viewer.oceanVariant === vibe.id}
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
          aria-pressed={viewer.showPerf}
          onclick={(e) => { e.stopPropagation(); viewer.togglePerf(); }}
        >
          <i class="fas fa-chart-line" aria-hidden="true"></i>
          <span>Performance</span>
          <span class="perf-indicator" class:on={viewer.showPerf}>
            {viewer.showPerf ? "ON" : "OFF"}
          </span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scene-popover {
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
    max-height: 85vh;
    overflow-y: auto;
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

  .scene-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .scene-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 4px;
    min-height: 72px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }

  .scene-tile:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }

  .scene-tile.active {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #cfe4ff;
    box-shadow: 0 2px 12px color-mix(in srgb, #4a9eff 20%, transparent);
  }

  .scene-tile i {
    font-size: 20px;
  }

  .scene-tile.active i {
    color: #8fc3ff;
  }

  .tile-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-align: center;
    line-height: 1.2;
  }

  .section-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 12px 0;
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
</style>
