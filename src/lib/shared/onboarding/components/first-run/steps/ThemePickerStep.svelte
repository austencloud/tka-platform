<!--
  ThemePickerStep - Let user choose their background theme

  Uses the same <background-card> web component as the settings BackgroundTab
  for visual consistency. Live preview applies theme on click.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import {
    registerBackgroundCard,
    BACKGROUND_CARD_REGISTRY,
  } from "@austencloud/backgrounds/card";
  import type { BackgroundCardSelectDetail } from "@austencloud/backgrounds/card";

  registerBackgroundCard();

  interface Props {
    initialValue?: BackgroundType;
    onNext: (theme: BackgroundType) => void;
    onBack: () => void;
    onSkip: () => void;
    onPreview: (theme: BackgroundType) => void;
  }

  const { initialValue, onNext, onBack, onSkip, onPreview }: Props = $props();

  let selectedTheme = $state<BackgroundType>(BackgroundType.WINTER);
  let gridEl: HTMLDivElement;

  $effect(() => {
    if (initialValue !== undefined) {
      selectedTheme = initialValue;
    }
  });

  const animatedBackgrounds = $derived(
    BACKGROUND_CARD_REGISTRY.filter(
      (bg) => bg.type !== BackgroundType.VOID
    )
  );

  function handleSelect(type: BackgroundType) {
    selectedTheme = type;
    onPreview(type);
  }

  function handleContinue() {
    onNext(selectedTheme);
  }

  onMount(() => {
    function handleCardSelect(e: Event) {
      const detail = (e as CustomEvent<BackgroundCardSelectDetail>).detail;
      handleSelect(detail.type as BackgroundType);
    }

    gridEl.addEventListener("background-select", handleCardSelect);
    return () => gridEl.removeEventListener("background-select", handleCardSelect);
  });
</script>

<div class="theme-picker-step">
  <h1 class="title">Choose your vibe</h1>
  <p class="subtitle">Pick a background that inspires you</p>

  <div
    class="themes-grid"
    bind:this={gridEl}
    role="radiogroup"
    aria-label="Choose background theme"
  >
    {#each animatedBackgrounds as bg}
      <background-card
        type={bg.type}
        selected={selectedTheme === bg.type ? "" : undefined}
      ></background-card>
    {/each}
  </div>

  <!-- Minimalist option -->
  <div class="minimalist-section">
    <span class="minimalist-label">Prefer something simpler?</span>
    <button
      class="minimalist-card"
      class:selected={selectedTheme === BackgroundType.VOID}
      onclick={() => handleSelect(BackgroundType.VOID)}
      aria-pressed={selectedTheme === BackgroundType.VOID}
      aria-label="Select Pure Black minimalist theme"
    >
      <div class="minimalist-preview"></div>
      <span class="minimalist-name">Pure Black</span>
    </button>
  </div>

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
    container-type: inline-size;
    container-name: theme-picker;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 560px;
    width: 100%;
    text-align: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
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
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    width: 100%;
    padding: 4px;
  }

  @container theme-picker (min-width: 400px) {
    .themes-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @container theme-picker (min-width: 520px) {
    .themes-grid {
      grid-template-columns: repeat(4, 1fr);
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
    margin-top: 4px;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
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
  }

  .skip-link:hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  /* Mobile */
  @media (max-width: 480px) {
    .theme-picker-step {
      padding: 16px;
      gap: 10px;
    }

    .title {
      font-size: 1.25rem;
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
    .minimalist-card,
    .back-button,
    .next-button,
    .skip-link {
      transition: none;
    }
  }
</style>
