<!--
  BackgroundCard.svelte - Background selection card with visual preview

  Uses the app's unified design system:
  - Glass surface styling from app.css
  - Standard transition timing
  - Theme-aware accent colors
  - Ring/border selection indicator (not iOS checkmark)
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../../../application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { BackgroundType } from "../../../../background/shared/domain/enums/background-enums";
  import { onMount } from "svelte";
  import type { BackgroundMetadata } from "./background-config";

  // Preview components
  import SnowfallPreview from "./previews/SnowfallPreview.svelte";
  import NightSkyPreview from "./previews/NightSkyPreview.svelte";
  import PridePreview from "./previews/PridePreview.svelte";
  import DeepOceanPreview from "./previews/DeepOceanPreview.svelte";
  import EmberGlowPreview from "./previews/EmberGlowPreview.svelte";
  import CherryBlossomPreview from "./previews/CherryBlossomPreview.svelte";
  import FireflyForestPreview from "./previews/FireflyForestPreview.svelte";
  import AutumnDriftPreview from "./previews/AutumnDriftPreview.svelte";
  import StaticGradientPreview from "./previews/StaticGradientPreview.svelte";

  const {
    background,
    isSelected,
    onSelect,
    orientation = "square",
  } = $props<{
    background: BackgroundMetadata;
    isSelected: boolean;
    onSelect: (type: BackgroundType) => void;
    orientation?: "portrait" | "landscape" | "square";
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleClick() {
    hapticService?.trigger("selection");
    onSelect(background.type);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      hapticService?.trigger("selection");
      onSelect(background.type);
    }
  }

  // Map background types to preview components
  const previewComponents = {
    [BackgroundType.SNOWFALL]: SnowfallPreview,
    [BackgroundType.NIGHT_SKY]: NightSkyPreview,
    [BackgroundType.PRIDE]: PridePreview,
    [BackgroundType.DEEP_OCEAN]: DeepOceanPreview,
    [BackgroundType.EMBER_GLOW]: EmberGlowPreview,
    [BackgroundType.SAKURA_DRIFT]: CherryBlossomPreview,
    [BackgroundType.FIREFLY_FOREST]: FireflyForestPreview,
    [BackgroundType.AUTUMN_DRIFT]: AutumnDriftPreview,
  } as const;

  // Check if this background type has an animated preview
  const hasAnimatedPreview = $derived(background.type in previewComponents);
</script>

<div
  class="background-card"
  class:selected={isSelected}
  data-orientation={orientation}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label={`Select ${background.name} background`}
  aria-pressed={isSelected}
>
  <!-- Background preview - animated or static -->
  {#if hasAnimatedPreview}
    {@const PreviewComponent =
      previewComponents[background.type as keyof typeof previewComponents]}
    <PreviewComponent />
  {:else}
    <StaticGradientPreview
      color={background.color}
      colors={background.colors}
      direction={background.direction}
    />
  {/if}

  <!-- Overlay with label -->
  <div class="card-overlay">
    <div class="card-icon">{@html background.icon}</div>
    <div class="card-info">
      <span class="card-name">{background.name}</span>
    </div>
  </div>
</div>

<style>
  /* ========================================
     BACKGROUND CARD - Unified Design System
     Uses app.css variables for consistency
     ======================================== */
  .background-card {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-2026-sm, 10px);
    overflow: hidden;
    cursor: pointer;

    /* Standard glass border */
    border: var(--glass-border);

    /* Glass surface */
    background: var(--surface-color);

    /* Container query support */
    container-type: size;

    /* Aspect ratio - 4:3 for good preview */
    aspect-ratio: 4 / 3;
    min-height: 70px;
    min-width: 70px;

    /* Standard shadow */
    box-shadow: var(--shadow-glass);

    /* Standard transition */
    transition:
      transform var(--transition-normal),
      border-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  /* Hover - subtle lift */
  .background-card:hover {
    transform: translateY(var(--hover-lift-sm, -1px))
      scale(var(--hover-scale-sm, 1.01));
    border: var(--glass-border-hover);
    box-shadow: var(--shadow-glass-hover);
  }

  /* Active - press feedback */
  .background-card:active {
    transform: scale(var(--active-scale, 0.98));
    transition-duration: var(--duration-instant, 100ms);
  }

  /* Selected - accent ring highlight */
  .background-card.selected {
    border: 2px solid var(--theme-accent, var(--theme-accent));
    box-shadow:
      var(--shadow-glass),
      0 0 0 2px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 25%,
          transparent
        ),
      0 4px 16px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 20%,
          transparent
        );
  }

  .background-card.selected:hover {
    transform: scale(var(--hover-scale-sm, 1.01));
    box-shadow:
      var(--shadow-glass-hover),
      0 0 0 2px color-mix(in srgb, var(--theme-accent) 35%, transparent),
      0 6px 20px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 25%,
          transparent
        );
  }

  /* Focus - accent outline */
  .background-card:focus-visible {
    outline: 2px solid var(--theme-accent, var(--theme-accent));
    outline-offset: 2px;
  }

  /* Overlay - gradient for text legibility */
  .card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.1) 0%,
      transparent 40%,
      transparent 60%,
      rgba(0, 0, 0, 0.5) 100%
    );
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: white;
    z-index: 1;
    padding: clamp(8px, 2.5cqi, 14px);
    pointer-events: none;
  }

  /* Icon */
  .card-icon {
    line-height: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
    font-size: clamp(18px, 5cqi, 32px);
    transition: transform var(--transition-normal);
  }

  .background-card:hover .card-icon {
    transform: scale(1.05);
  }

  /* Info section */
  .card-info {
    display: flex;
    align-items: flex-end;
  }

  .card-name {
    font-size: clamp(12px, 3.5cqi, 15px);
    font-weight: 600;
    line-height: 1.3;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
  }

  /* ========================================
     RESPONSIVE - Container Queries
     ======================================== */

  /* Compact cards (small containers) */
  @container (max-width: 120px) {
    .background-card {
      min-height: 50px;
      min-width: 50px;
      border-radius: var(--radius-2026-xs, 6px);
    }

    .card-name {
      font-size: var(--font-size-compact);
    }

    .card-icon {
      font-size: var(--font-size-base);
    }

    .card-overlay {
      padding: 6px;
    }
  }

  /* Desktop optimization - squarer aspect ratio */
  @container (min-width: 100px) and (max-width: 200px) {
    .background-card {
      aspect-ratio: 5 / 4;
      min-height: 60px;
    }

    .card-name {
      font-size: var(--font-size-compact);
    }

    .card-icon {
      font-size: clamp(14px, 4cqi, 20px);
    }
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .background-card,
    .card-icon {
      transition: none;
    }

    .background-card:hover,
    .background-card.selected,
    .background-card:active {
      transform: none;
    }

    .background-card:hover .card-icon {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .background-card {
      border: 2px solid rgba(255, 255, 255, 0.4);
    }

    .background-card.selected {
      border: 3px solid var(--theme-accent, var(--theme-accent));
    }
  }

  @media (prefers-contrast: high) and (prefers-color-scheme: light) {
    .background-card {
      border: 2px solid rgba(0, 0, 0, 0.4);
    }
  }
</style>
