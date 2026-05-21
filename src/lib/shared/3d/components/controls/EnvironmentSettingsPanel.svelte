<script lang="ts">
  /**
   * EnvironmentSettingsPanel
   *
   * Visual card-based background/environment selector for the 3D viewer side panel.
   * Shows themed environment options as tappable cards with icons.
   *
   * This uses BackgroundType from the shared settings - changing the environment
   * here changes the app-wide background theme (and vice versa).
   */

  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  // Background types with 3D environment support
  // Others will show but with "no 3D scene" indicator
  interface BackgroundOption {
    type: BackgroundType;
    name: string;
    icon: string;
    has3DScene: boolean;
  }

  const backgroundOptions: BackgroundOption[] = [
    // With 3D scenes
    {
      type: BackgroundType.FOREST,
      name: "Forest",
      icon: "fa-tree",
      has3DScene: true,
    },
    {
      type: BackgroundType.AUTUMN,
      name: "Autumn",
      icon: "fa-leaf",
      has3DScene: true,
    },
    {
      type: BackgroundType.COSMIC,
      name: "Cosmic",
      icon: "fa-moon",
      has3DScene: true,
    },
    // All animated backgrounds have 3D scenes
    {
      type: BackgroundType.WINTER,
      name: "Winter",
      icon: "fa-snowflake",
      has3DScene: true,
    },
    {
      type: BackgroundType.OCEAN,
      name: "Ocean",
      icon: "fa-water",
      has3DScene: true,
    },
    {
      type: BackgroundType.EMBER,
      name: "Ember",
      icon: "fa-fire",
      has3DScene: true,
    },
    {
      type: BackgroundType.BLOSSOM,
      name: "Blossom",
      icon: "fa-spa",
      has3DScene: true,
    },
    // Simple backgrounds don't have 3D scenes
    {
      type: BackgroundType.SOLID_COLOR,
      name: "Solid",
      icon: "fa-square",
      has3DScene: false,
    },
  ];

  // Get current background from settings
  const currentBackground = $derived(settingsService.settings.backgroundType);

  function handleSelect(type: BackgroundType) {
    settingsService.updateSetting("backgroundType", type);
  }
</script>

<section class="environment-panel">
  <header class="panel-header">
    <i class="fas fa-mountain-sun" aria-hidden="true"></i>
    <span>{t("viewer3d_environment")}</span>
  </header>

  <div
    class="environment-grid"
    role="radiogroup"
    aria-label={t("viewer3d_environment")}
  >
    {#each backgroundOptions as option}
      <button
        class="env-card"
        class:selected={option.type === currentBackground}
        class:no-scene={!option.has3DScene}
        role="radio"
        aria-checked={option.type === currentBackground}
        onclick={() => handleSelect(option.type)}
        aria-label={option.has3DScene ? option.name : `${option.name} (2D only)`}
        title={option.has3DScene ? option.name : `${option.name} (2D only)`}
      >
        <i class="fas {option.icon}" aria-hidden="true"></i>
        <span class="env-name">{option.name}</span>
        {#if !option.has3DScene}
          <span class="badge-2d">2D</span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .environment-panel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
  }

  .panel-header i {
    opacity: 0.7;
  }

  .environment-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .env-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    min-height: 72px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .env-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .env-card.selected {
    background: var(--theme-accent, #f97316);
    border-color: var(--theme-accent, #f97316);
    color: white;
  }

  .env-card.no-scene:not(.selected) {
    opacity: 0.7;
  }

  .env-card i {
    font-size: 1.25rem;
  }

  .env-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-align: center;
  }

  .badge-2d {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    padding: 1px 4px;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .env-card.selected .badge-2d {
    background: color-mix(in srgb, var(--theme-text, white) 25%, transparent);
    color: var(--theme-text, white);
  }

  @media (max-width: 400px) {
    .environment-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 0.375rem;
    }

    .env-card {
      padding: 0.5rem 0.25rem;
      min-height: 64px;
    }

    .env-card i {
      font-size: 1rem;
    }
  }
</style>
