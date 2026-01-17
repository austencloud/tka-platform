<!--
AssemblyWelcome.svelte - Welcome/onboarding screen for Assembly tab

Explains what the Assembly mode does and guides user to start building.
Shown when sequence is empty.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const { gridMode, onStart, onGridModeChange } = $props<{
    gridMode: GridMode;
    onStart: () => void;
    onGridModeChange: (mode: GridMode) => void;
  }>();

  const isDiamond = $derived(gridMode === GridMode.DIAMOND);

  // Access haptic feedback service from ITI container
  const hapticService = container.items.hapticFeedback as IHapticFeedback;

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
    <!-- Animated Icon -->
    <div class="welcome-icon">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Grid dots that match current mode -->
        {#if isDiamond}
          <circle cx="32" cy="8" r="5" class="grid-dot active" style="--delay: 0" />
          <circle cx="56" cy="32" r="5" class="grid-dot active" style="--delay: 1" />
          <circle cx="32" cy="56" r="5" class="grid-dot active" style="--delay: 2" />
          <circle cx="8" cy="32" r="5" class="grid-dot active" style="--delay: 3" />
          <circle cx="8" cy="8" r="4" class="grid-dot inactive" />
          <circle cx="56" cy="8" r="4" class="grid-dot inactive" />
          <circle cx="8" cy="56" r="4" class="grid-dot inactive" />
          <circle cx="56" cy="56" r="4" class="grid-dot inactive" />
        {:else}
          <circle cx="8" cy="8" r="5" class="grid-dot active" style="--delay: 0" />
          <circle cx="56" cy="8" r="5" class="grid-dot active" style="--delay: 1" />
          <circle cx="56" cy="56" r="5" class="grid-dot active" style="--delay: 2" />
          <circle cx="8" cy="56" r="5" class="grid-dot active" style="--delay: 3" />
          <circle cx="32" cy="8" r="4" class="grid-dot inactive" />
          <circle cx="56" cy="32" r="4" class="grid-dot inactive" />
          <circle cx="32" cy="56" r="4" class="grid-dot inactive" />
          <circle cx="8" cy="32" r="4" class="grid-dot inactive" />
        {/if}
        <!-- Animated path trace -->
        <path
          class="trace-path"
          d={isDiamond
            ? "M32 8 L56 32 L32 56 L8 32 Z"
            : "M8 8 L56 8 L56 56 L8 56 Z"}
          stroke="var(--theme-accent)"
          stroke-width="2"
          fill="none"
        />
      </svg>
    </div>

    <!-- Title -->
    <h1 class="welcome-title">{t("assembly_title")}</h1>

    <!-- Compact description -->
    <p class="welcome-description">
      Trace hand paths on a grid, then merge them into a sequence.
    </p>

    <!-- Grid Mode Toggle - Hero element -->
    <div class="grid-mode-section">
      <div class="grid-mode-toggle">
        <button
          class="mode-button"
          class:active={isDiamond}
          onclick={() => handleGridModeChange(GridMode.DIAMOND)}
        >
          <div class="mode-preview diamond">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="mode-name">{t("assembly_diamond")}</span>
          <span class="mode-positions">N · E · S · W</span>
        </button>
        <button
          class="mode-button"
          class:active={!isDiamond}
          onclick={() => handleGridModeChange(GridMode.BOX)}
        >
          <div class="mode-preview box">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="mode-name">{t("assembly_box")}</span>
          <span class="mode-positions">NW · NE · SE · SW</span>
        </button>
      </div>
    </div>

    <!-- Start Button -->
    <button class="start-button" onclick={handleStart}>
      <span class="button-text">{t("assembly_start_building")}</span>
      <span class="button-icon">→</span>
    </button>

    <!-- Minimal hint -->
    <p class="keyboard-hint">
      Tip: Use numpad keys for rapid building
    </p>
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
    max-width: 420px;
    text-align: center;
    gap: 24px;
  }

  /* Animated welcome icon */
  .welcome-icon {
    width: 100px;
    height: 100px;
  }

  .welcome-icon svg {
    width: 100%;
    height: 100%;
  }

  /* Grid dots in the icon */
  .welcome-icon :global(.grid-dot) {
    transition: all var(--duration-emphasis) ease;
  }

  .welcome-icon :global(.grid-dot.active) {
    fill: var(--theme-accent);
    animation: dot-pulse 2s ease-in-out infinite;
    animation-delay: calc(var(--delay) * var(--duration-fast));
  }

  .welcome-icon :global(.grid-dot.inactive) {
    fill: var(--theme-stroke);
    opacity: 0.3;
  }

  @keyframes dot-pulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  /* Animated trace path */
  .welcome-icon :global(.trace-path) {
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
    animation: trace-draw 3s ease-in-out infinite;
    opacity: 0.6;
  }

  @keyframes trace-draw {
    0% { stroke-dashoffset: 200; opacity: 0.3; }
    50% { stroke-dashoffset: 0; opacity: 0.6; }
    100% { stroke-dashoffset: -200; opacity: 0.3; }
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
    color: var(--theme-text-dim);
    margin: 0;
    max-width: 320px;
  }

  /* Grid mode toggle - Hero element */
  .grid-mode-section {
    width: 100%;
  }

  .grid-mode-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .mode-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 16px;
    border: 2px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    border-radius: 16px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .mode-button.active {
    border-color: var(--theme-accent);
    background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card-bg));
    color: var(--theme-text);
    box-shadow: 0 0 20px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .mode-button:hover:not(.active) {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }

  /* Mini grid preview in mode buttons */
  .mode-preview {
    width: 48px;
    height: 48px;
    position: relative;
  }

  .mode-preview .dot {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
    transition: all var(--duration-normal) ease;
  }

  /* Diamond mode: N, E, S, W */
  .mode-preview.diamond .dot:nth-child(1) { top: 0; left: 50%; transform: translateX(-50%); }
  .mode-preview.diamond .dot:nth-child(2) { top: 50%; right: 0; transform: translateY(-50%); }
  .mode-preview.diamond .dot:nth-child(3) { bottom: 0; left: 50%; transform: translateX(-50%); }
  .mode-preview.diamond .dot:nth-child(4) { top: 50%; left: 0; transform: translateY(-50%); }

  /* Box mode: corners */
  .mode-preview.box .dot:nth-child(1) { top: 0; left: 0; }
  .mode-preview.box .dot:nth-child(2) { top: 0; right: 0; }
  .mode-preview.box .dot:nth-child(3) { bottom: 0; right: 0; }
  .mode-preview.box .dot:nth-child(4) { bottom: 0; left: 0; }

  .mode-button.active .mode-preview .dot {
    background: var(--theme-accent);
    box-shadow: 0 0 8px var(--theme-accent);
  }

  .mode-name {
    font-size: var(--font-size-base);
    font-weight: 600;
  }

  .mode-positions {
    font-size: var(--font-size-compact);
    opacity: 0.7;
  }

  /* Start button */
  .start-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 18px 24px;
    background: linear-gradient(135deg, var(--theme-accent-strong), var(--theme-accent));
    border: none;
    border-radius: 14px;
    color: white;
    font-size: var(--font-size-lg);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 4px 20px color-mix(in srgb, var(--theme-accent-strong) 35%, transparent);
  }

  .start-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px color-mix(in srgb, var(--theme-accent-strong) 45%, transparent);
  }

  .start-button:active {
    transform: translateY(0);
  }

  .button-icon {
    font-size: var(--font-size-xl);
    transition: transform var(--duration-normal) ease;
  }

  .start-button:hover .button-icon {
    transform: translateX(4px);
  }

  /* Keyboard hint */
  .keyboard-hint {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    opacity: 0.6;
    margin: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .assembly-welcome {
      padding: 16px;
    }

    .welcome-content {
      gap: 20px;
    }

    .welcome-icon {
      width: 80px;
      height: 80px;
    }

    .welcome-title {
      font-size: var(--font-size-2xl);
    }

    .mode-button {
      padding: 16px 12px;
    }

    .mode-preview {
      width: 40px;
      height: 40px;
    }

    .mode-preview .dot {
      width: 8px;
      height: 8px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .welcome-icon :global(.grid-dot.active),
    .welcome-icon :global(.trace-path) {
      animation: none;
    }

    .welcome-icon :global(.trace-path) {
      stroke-dasharray: none;
      stroke-dashoffset: 0;
      opacity: 0.5;
    }
  }
</style>
