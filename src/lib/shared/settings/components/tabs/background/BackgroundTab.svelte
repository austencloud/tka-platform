<!--
  BackgroundTab.svelte - Theme/Background Settings

  Polished glass panel layout matching Visibility and Profile tabs.
  Groups backgrounds into Animated and Simple categories.
-->
<script lang="ts">
  import type { AppSettings } from "../../../domain/AppSettings";
  import { container } from "$lib/shared/di";
  import { BackgroundType } from "../../../../background/shared/domain/enums/background-enums";
  import type { IDeviceDetector } from "../../../../device/services/contracts/IDeviceDetector";
  import type { IViewportManager } from "../../../../device/services/contracts/IViewportManager";
  import { onMount } from "svelte";
  import BackgroundCard from "./BackgroundCard.svelte";
  import { backgroundsConfig } from "./background-config";
  import { applyThemeFromColors } from "../../../utils/background-theme-calculator";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let { settings, onUpdate } = $props<{
    settings: AppSettings;
    onUpdate?: (event: { key: string; value: unknown }) => void;
  }>();

  // Services
  let deviceDetector: IDeviceDetector | null = null;
  let viewportService: IViewportManager | null = null;

  // Device orientation state
  let orientation = $state<"portrait" | "landscape" | "square">("square");

  // Entry animation
  let isVisible = $state(false);

  // Background settings state - initialized with defaults, synced from settings via $effect
  let backgroundSettings = $state({
    backgroundEnabled: true,
    backgroundType: BackgroundType.NIGHT_SKY,
    backgroundQuality: "medium" as string,
    backgroundColor: "#000000",
    gradientColors: ["#0d1117", "#161b22", "#21262d"],
    gradientDirection: 135,
  });

  // Sync from settings prop
  $effect(() => {
    backgroundSettings = {
      backgroundEnabled: settings?.backgroundEnabled ?? true,
      backgroundType: settings?.backgroundType || BackgroundType.NIGHT_SKY,
      backgroundQuality: settings?.backgroundQuality || "medium",
      backgroundColor: settings?.backgroundColor || "#000000",
      gradientColors: settings?.gradientColors || [
        "#0d1117",
        "#161b22",
        "#21262d",
      ],
      gradientDirection: settings?.gradientDirection || 135,
    };
  });

  // Split backgrounds into categories
  const animatedBackgrounds = backgroundsConfig.filter(
    (bg) =>
      bg.type !== BackgroundType.SOLID_COLOR &&
      bg.type !== BackgroundType.LINEAR_GRADIENT
  );

  const simpleBackgrounds = backgroundsConfig.filter(
    (bg) =>
      bg.type === BackgroundType.SOLID_COLOR ||
      bg.type === BackgroundType.LINEAR_GRADIENT
  );

  onMount(() => {
    // Initialize services
    deviceDetector = container.items.deviceDetector;
    viewportService = container.items.viewportManager;

    // Set initial orientation
    updateOrientation();

    // Subscribe to viewport changes
    const unsubscribe = viewportService?.onViewportChange(() => {
      updateOrientation();
    });

    // Entry animation
    setTimeout(() => (isVisible = true), 30);

    return () => {
      unsubscribe?.();
    };
  });

  function updateOrientation() {
    if (!viewportService) return;

    if (viewportService.isLandscape()) {
      orientation = "landscape";
    } else if (viewportService.isPortrait()) {
      orientation = "portrait";
    } else {
      orientation = "square";
    }
  }

  function updateBackgroundSetting<K extends keyof typeof backgroundSettings>(
    key: K,
    value: (typeof backgroundSettings)[K]
  ) {
    backgroundSettings[key] = value;
    onUpdate?.({ key, value });
  }

  function handleBackgroundSelect(selectedType: BackgroundType) {
    // Find the background config to get color/gradient info
    const bgConfig = backgroundsConfig.find((bg) => bg.type === selectedType);

    // IMPORTANT: Update colors/gradient FIRST before updating type
    // This ensures the crossfade transition has access to the custom options
    if (bgConfig) {
      if (selectedType === BackgroundType.SOLID_COLOR && bgConfig.color) {
        updateBackgroundSetting("backgroundColor", bgConfig.color);
        applyThemeFromColors(bgConfig.color);
      } else if (
        selectedType === BackgroundType.LINEAR_GRADIENT &&
        bgConfig.colors
      ) {
        updateBackgroundSetting("gradientColors", bgConfig.colors);
        updateBackgroundSetting("gradientDirection", bgConfig.direction || 135);
        applyThemeFromColors(undefined, bgConfig.colors);
      } else if (bgConfig.themeColors) {
        // Animated backgrounds: use themeColors for UI theming
        applyThemeFromColors(undefined, bgConfig.themeColors);
      }
    }

    // Update the background type LAST to trigger the crossfade with custom options
    updateBackgroundSetting("backgroundType", selectedType);
  }
</script>

<div class="background-tab" class:visible={isVisible}>
  {#if backgroundSettings.backgroundEnabled}
    <!-- Main Glass Panel -->
    <section class="settings-panel">
      <header class="panel-header">
        <span class="panel-icon"
          ><i class="fas fa-palette" aria-hidden="true"></i></span
        >
        <div class="panel-header-text">
          <h3 class="panel-title">{t("settings_background_theme")}</h3>
          <p class="panel-subtitle">{t("settings_background_subtitle")}</p>
        </div>
      </header>

      <!-- Animated Backgrounds Section -->
      <div class="category-section">
        <div class="category-header">
          <span class="category-icon"
            ><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i></span
          >
          <span class="category-label">{t("settings_animated")}</span>
        </div>
        <div class="card-grid animated-grid">
          {#each animatedBackgrounds as background}
            <BackgroundCard
              {background}
              isSelected={backgroundSettings.backgroundType === background.type}
              onSelect={handleBackgroundSelect}
              {orientation}
            />
          {/each}
        </div>
      </div>

      <!-- Simple Backgrounds Section -->
      <div class="category-section">
        <div class="category-header">
          <span class="category-icon"
            ><i class="fas fa-circle" aria-hidden="true"></i></span
          >
          <span class="category-label">{t("settings_simple")}</span>
        </div>
        <div class="card-grid simple-grid">
          {#each simpleBackgrounds as background}
            <BackgroundCard
              {background}
              isSelected={backgroundSettings.backgroundType === background.type}
              onSelect={handleBackgroundSelect}
              {orientation}
            />
          {/each}
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     BACKGROUND TAB - Polished Glass Panel Layout
     Matches Visibility and Profile tab styling
     ═══════════════════════════════════════════════════════════════════════════ */
  .background-tab {
    container-type: inline-size;
    container-name: background-tab;

    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: clamp(8px, 2cqi, 16px);
    gap: clamp(10px, 1.5cqi, 16px);

    /* Enable scrolling */
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;

    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .background-tab.visible {
    opacity: 1;
  }

  /* ========================================
     SETTINGS PANEL - Theme-aware
     ======================================== */
  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2cqi, 20px);
    padding: clamp(12px, 2cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }

  .settings-panel:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
  }

  /* ========================================
     PANEL HEADER
     ======================================== */
  .panel-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2cqi, 14px);
    padding-bottom: clamp(10px, 2cqi, 14px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(36px, 8cqi, 44px);
    height: clamp(36px, 8cqi, 44px);
    border-radius: 10px;
    font-size: clamp(14px, 3cqi, 18px);
    flex-shrink: 0;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 35%, transparent);
    color: var(--theme-accent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
    transition: all var(--duration-fast) ease;
  }

  .settings-panel:hover .panel-icon {
    box-shadow: 0 0 16px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .panel-header-text {
    flex: 1;
    min-width: 0;
  }

  .panel-title {
    font-size: clamp(15px, 3cqi, 17px);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .panel-subtitle {
    font-size: clamp(12px, 2.5cqi, 13px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 2px 0 0 0;
  }

  /* ========================================
     CATEGORY SECTIONS
     ======================================== */
  .category-section {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.5cqi, 12px);
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .category-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(20px, 4cqi, 24px);
    height: clamp(20px, 4cqi, 24px);
    border-radius: 5px;
    font-size: clamp(10px, 2cqi, 12px);
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .category-label {
    font-size: clamp(11px, 2cqi, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  /* ========================================
     CARD GRIDS
     ======================================== */
  .card-grid {
    display: grid;
    gap: clamp(8px, 1.5cqi, 12px);
    width: 100%;
  }

  /* Default: 2 columns for mobile */
  .animated-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .simple-grid {
    grid-template-columns: repeat(2, 1fr);
    align-items: start;
  }

  /* Medium containers (tablet): 3 columns for animated */
  @container background-tab (min-width: 400px) {
    .animated-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Large containers (desktop): 4 columns for animated to fit everything */
  @container background-tab (min-width: 600px) {
    .animated-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .simple-grid {
      grid-template-columns: repeat(2, 1fr);
      max-width: 50%; /* Keep simple cards from stretching too wide */
    }
  }

  /* ========================================
     SCROLLBAR
     ======================================== */
  .background-tab::-webkit-scrollbar {
    width: 6px;
  }

  .background-tab::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .background-tab::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent);
    border-radius: 3px;
  }

  .background-tab::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-accent-hover);
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .background-tab,
    .settings-panel,
    .panel-icon {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .settings-panel {
      border-width: 2px;
    }
  }
</style>
