<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";
  import SceneFeatureTiles from "../scene-features/components/SceneFeatureTiles.svelte";
  import { tryGetSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import Save3DSceneButton from "./controls/Save3DSceneButton.svelte";

  const currentBg = $derived(settingsService.settings.backgroundType);
  const hasSceneFeatures = tryGetSceneFeatureContext() !== undefined;

  function selectScene(e: MouseEvent, type: BackgroundType) {
    e.stopPropagation();
    settingsService.updateSetting("backgroundType", type);
  }
</script>

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

<div class="section-divider"></div>
<Save3DSceneButton />

<style>
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
    background: color-mix(in srgb, var(--theme-accent, #4a9eff) 18%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #4a9eff) 50%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #4a9eff) 40%, #ffffff);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--theme-accent, #4a9eff) 20%, transparent);
  }

  .scene-tile i {
    font-size: 20px;
  }

  .scene-tile.active i {
    color: color-mix(in srgb, var(--theme-accent, #4a9eff) 60%, #ffffff);
  }

  .tile-label {
    font-size: var(--font-size-compact, 12px);
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
