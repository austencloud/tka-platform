<!--
AssemblyWelcome.svelte - Welcome/onboarding screen for Assembly tab

Explains what the Assembly mode does and guides user to start building.
Shown when sequence is empty.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const { gridMode, onStart, onGridModeChange } = $props<{
    gridMode: GridMode;
    onStart: () => void;
    onGridModeChange: (mode: GridMode) => void;
  }>();

  const isDiamond = $derived(gridMode === GridMode.DIAMOND);

  // Resolve haptic feedback service
  const hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);

  function handleStart() {
    hapticService?.trigger("selection");
    onStart();
  }

  function handleGridModeChange(mode: GridMode) {
    hapticService?.trigger("selection");
    onGridModeChange(mode);
  }
</script>

<div class="assembly-welcome">
  <div class="welcome-content">
    <!-- Icon -->
    <div class="welcome-icon">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Grid dots -->
        <circle cx="32" cy="12" r="4" fill="currentColor" opacity="0.8" />
        <circle cx="52" cy="32" r="4" fill="currentColor" opacity="0.8" />
        <circle cx="32" cy="52" r="4" fill="currentColor" opacity="0.8" />
        <circle cx="12" cy="32" r="4" fill="currentColor" opacity="0.8" />
        <!-- Path lines -->
        <path
          d="M32 12 L52 32 L32 52 L12 32 Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-dasharray="4 4"
          fill="none"
          opacity="0.4"
        />
        <!-- Hand indicator -->
        <circle cx="32" cy="32" r="8" fill="rgba(59, 130, 246, 0.3)" />
        <circle cx="32" cy="32" r="4" fill="var(--semantic-info)" />
      </svg>
    </div>

    <!-- Title -->
    <h1 class="welcome-title">{t("assembly_title")}</h1>

    <!-- Description -->
    <p class="welcome-description">
      {t("assembly_description")}
    </p>

    <!-- How it works -->
    <div class="how-it-works">
      <h2 class="section-title">{t("assembly_how_it_works")}</h2>
      <ol class="steps-list">
        <li>
          <span class="step-number blue">1</span>
          <span class="step-text"
            >{t("assembly_step1", { hand: "" })} <strong>{t("assembly_blue_hand")}</strong></span
          >
        </li>
        <li>
          <span class="step-number red">2</span>
          <span class="step-text"
            >{t("assembly_step2", { hand: "" })} <strong>{t("assembly_red_hand")}</strong></span
          >
        </li>
        <li>
          <span class="step-number green">3</span>
          <span class="step-text">{t("assembly_step3")}</span>
        </li>
      </ol>
    </div>

    <!-- Grid Mode Toggle -->
    <div class="grid-mode-section">
      <span class="grid-mode-label">{t("assembly_grid_mode")}</span>
      <div class="grid-mode-toggle">
        <button
          class="mode-button"
          class:active={isDiamond}
          onclick={() => handleGridModeChange(GridMode.DIAMOND)}
        >
          <span class="mode-icon">◇</span>
          {t("assembly_diamond")}
        </button>
        <button
          class="mode-button"
          class:active={!isDiamond}
          onclick={() => handleGridModeChange(GridMode.BOX)}
        >
          <span class="mode-icon">□</span>
          {t("assembly_box")}
        </button>
      </div>
    </div>

    <!-- Start Button -->
    <button class="start-button" onclick={handleStart}>
      <span class="button-text">{t("assembly_start_building")}</span>
      <span class="button-icon">→</span>
    </button>
  </div>
</div>

<style>
  .assembly-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding: 24px;
    overflow-y: auto;
  }

  .welcome-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 400px;
    text-align: center;
    gap: 20px;
  }

  .welcome-icon {
    width: 80px;
    height: 80px;
    color: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 90%,
      transparent
    );
    margin-bottom: 8px;
  }

  .welcome-icon svg {
    width: 100%;
    height: 100%;
  }

  .welcome-title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .welcome-description {
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
  }

  /* How it works section */
  .how-it-works {
    width: 100%;
    background: var(--theme-card-bg);
    border-radius: 12px;
    padding: 16px 20px;
    margin-top: 4px;
  }

  .section-title {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim);
    margin: 0 0 12px 0;
  }

  .steps-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .steps-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
  }

  .step-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-number.blue {
    background: rgba(59, 130, 246, 0.2);
    color: var(--semantic-info);
  }

  .step-number.red {
    background: rgba(239, 68, 68, 0.2);
    color: var(--semantic-error);
  }

  .step-number.green {
    background: rgba(16, 185, 129, 0.2);
    color: var(--semantic-success);
  }

  .step-text {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .step-text strong {
    color: var(--theme-text, var(--theme-text));
  }

  /* Grid mode toggle */
  .grid-mode-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .grid-mode-label {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .grid-mode-toggle {
    display: flex;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 8px;
    padding: 4px;
    gap: 4px;
  }

  .mode-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-button.active {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 20%,
      transparent
    );
    color: var(--theme-text);
  }

  .mode-button:hover:not(.active) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .mode-icon {
    font-size: var(--font-size-base);
  }

  /* Start button */
  .start-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 280px;
    padding: 16px 24px;
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong, var(--theme-accent-strong)),
      var(--theme-accent-strong)
    );
    border: none;
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 16px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
        transparent
      );
    margin-top: 8px;
  }

  .start-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 40%,
        transparent
      );
  }

  .start-button:active {
    transform: translateY(0);
  }

  .button-icon {
    font-size: var(--font-size-lg);
    transition: transform 0.2s ease;
  }

  .start-button:hover .button-icon {
    transform: translateX(4px);
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .assembly-welcome {
      padding: 16px;
    }

    .welcome-icon {
      width: 64px;
      height: 64px;
    }

    .welcome-title {
      font-size: var(--font-size-2xl);
    }

    .welcome-description {
      font-size: var(--font-size-sm);
    }
  }
</style>
