<!--
  ThemePickerStep - Let user choose their background theme

  Shows a grid of available backgrounds with live preview.
  When user clicks a theme, it immediately applies so they can see it.
-->
<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import {
    BACKGROUND_CARD_REGISTRY,
    getCardMetadata,
  } from "@austencloud/backgrounds/card";

  interface Props {
    initialValue?: BackgroundType;
    onNext: (theme: BackgroundType) => void;
    onBack: () => void;
    onSkip: () => void;
    onPreview: (theme: BackgroundType) => void;
  }

  const { initialValue, onNext, onBack, onSkip, onPreview }: Props = $props();

  // Initialize with default, sync with initialValue when provided
  let selectedTheme = $state<BackgroundType>(BackgroundType.SNOWFALL);

  // Sync with initialValue when component mounts or value changes
  $effect(() => {
    if (initialValue !== undefined) {
      selectedTheme = initialValue;
    }
  });

  // Animated backgrounds for the main grid
  const animatedBackgrounds = $derived(
    BACKGROUND_CARD_REGISTRY.filter(
      (bg) =>
        bg.type !== BackgroundType.SOLID_COLOR &&
        bg.type !== BackgroundType.LINEAR_GRADIENT
    )
  );

  // Minimalist option (pure black)
  const minimalistOption = $derived(
    getCardMetadata(BackgroundType.SOLID_COLOR)
  );

  function handleSelect(type: BackgroundType) {
    selectedTheme = type;
    onPreview(type);
  }

  function handleContinue() {
    onNext(selectedTheme);
  }
</script>

<div class="theme-picker-step">
  <div class="icon-container">
    <i class="fas fa-palette" aria-hidden="true"></i>
  </div>

  <h1 class="title">Choose your vibe</h1>

  <p class="subtitle">Pick a background that inspires you</p>

  <div class="themes-grid">
    {#each animatedBackgrounds as bg}
      <button
        class="theme-card"
        class:selected={selectedTheme === bg.type}
        onclick={() => handleSelect(bg.type as BackgroundType)}
        aria-pressed={selectedTheme === bg.type}
        aria-label={`Select ${bg.label} theme`}
      >
        <div
          class="theme-preview"
          style="background: linear-gradient(135deg, {bg.themeColors?.[0] ??
            '#1a1a2e'}, {bg.themeColors?.[1] ?? '#16213e'})"
        >
          <span class="theme-icon">{@html bg.iconSvg}</span>
        </div>
        <span class="theme-name">{bg.label}</span>
        {#if selectedTheme === bg.type}
          <div class="selected-badge">
            <i class="fas fa-check" aria-hidden="true"></i>
          </div>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Minimalist option -->
  {#if minimalistOption}
    <div class="minimalist-section">
      <span class="minimalist-label">Prefer something simpler?</span>
      <button
        class="minimalist-card"
        class:selected={selectedTheme === BackgroundType.SOLID_COLOR}
        onclick={() => handleSelect(BackgroundType.SOLID_COLOR)}
        aria-pressed={selectedTheme === BackgroundType.SOLID_COLOR}
        aria-label="Select Pure Black minimalist theme"
      >
        <div class="minimalist-preview"></div>
        <span class="minimalist-name">Pure Black</span>
        {#if selectedTheme === BackgroundType.SOLID_COLOR}
          <div class="selected-badge">
            <i class="fas fa-check" aria-hidden="true"></i>
          </div>
        {/if}
      </button>
    </div>
  {/if}

  <p class="hint">Tap a theme to preview it live</p>

  <div class="button-row">
    <button
      type="button"
      class="back-button"
      onclick={onBack}
      aria-label="Go back"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>

    <button type="button" class="next-button" onclick={handleContinue}>
      Continue <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </button>
  </div>

  <button type="button" class="skip-link" onclick={onSkip}>
    Skip for now
  </button>
</div>

<style>
  .theme-picker-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 560px;
    width: 100%;
    text-align: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, #a855f7 15%, transparent);
    border-radius: 18px;
    font-size: 1.5rem;
    color: #a855f7;
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .themes-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    width: 100%;
    padding: 4px;
    margin: 8px 0;
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .theme-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .theme-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 20%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
    transform: scale(1.02);
  }

  .theme-card:active {
    transform: scale(0.97);
  }

  .theme-preview {
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .theme-icon {
    font-size: 1.5rem;
    opacity: 0.9;
  }

  .theme-icon :global(i) {
    color: rgba(255, 255, 255, 0.8);
  }

  .theme-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .selected-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent-strong, #8b5cf6);
    border-radius: 50%;
    color: white;
    font-size: 0.65rem;
    animation: pop-in var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes pop-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Minimalist section */
  .minimalist-section {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .minimalist-label {
    font-size: 0.8rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .minimalist-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .minimalist-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .minimalist-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 20%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  .minimalist-preview {
    width: 28px;
    height: 18px;
    background: #000;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .minimalist-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .hint {
    font-size: 0.8rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
    font-style: italic;
  }

  .button-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .next-button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .next-button:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
  }

  .skip-link {
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9rem;
    cursor: pointer;
    transition: color var(--duration-normal) ease;
    margin-top: 4px;
  }

  .skip-link:hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  /* Mobile - 2 columns */
  @media (max-width: 480px) {
    .theme-picker-step {
      padding: 16px;
    }

    .themes-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .icon-container {
      width: 56px;
      height: 56px;
      font-size: 1.3rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .theme-icon {
      font-size: 1.25rem;
    }

    .theme-name {
      font-size: 0.7rem;
    }

    .minimalist-section {
      flex-direction: column;
      gap: 8px;
    }

    .minimalist-label {
      font-size: 0.75rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .theme-card,
    .minimalist-card,
    .back-button,
    .next-button,
    .skip-link {
      transition: none;
    }

    .theme-card:hover,
    .theme-card:active,
    .theme-card.selected {
      transform: none;
    }

    .selected-badge {
      animation: none;
    }
  }
</style>
