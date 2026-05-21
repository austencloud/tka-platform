<script lang="ts">
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";
  import SceneFeatureTiles from "../scene-features/components/SceneFeatureTiles.svelte";
  import { tryGetSceneFeatureContext } from "../scene-features/context/scene-feature-context";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "scene");
  const currentBg = $derived(settingsService.settings.backgroundType);
  const hasSceneFeatures = tryGetSceneFeatureContext() !== undefined;

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

</style>
