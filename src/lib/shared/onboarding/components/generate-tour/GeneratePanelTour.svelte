<!--
  GeneratePanelTour - Guided tour overlay for the generate panel.

  Renders as a fixed overlay with a dark backdrop. Highlights one card
  at a time in the generate panel by communicating the active stop
  via tour state. Shows a floating explanation card with step dots.
-->
<script lang="ts">
  import {
    generateTourState,
    type GenerateTourStop,
  } from "../../state/generate-tour-state.svelte";
  import {
    generatorHelpContent,
    type GeneratorHelpItem,
  } from "$lib/features/create/generate/domain/generator-help-content";
  import type { GeneratorHelpId } from "$lib/features/create/generate/domain/generator-help-content";

  // Map tour stops to help content IDs
  const stopToHelpId: Record<GenerateTourStop, GeneratorHelpId> = {
    "level": "level",
    "length": "length",
    "word-input": "generation-mode",
    "grid-mode": "grid-mode",
    "turn-intensity": "turn-intensity",
    "slice-size": "slice-size",
    "generate-button": "generate",
  };

  const currentHelpContent: GeneratorHelpItem | undefined = $derived(
    generatorHelpContent.find(
      (c) => c.id === stopToHelpId[generateTourState.currentStop]
    )
  );

  function handleNext() {
    generateTourState.advance();
  }

  function handleSkip() {
    generateTourState.skip();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!generateTourState.isActive) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleSkip();
    }
  }
</script>

<svelte:window onkeydowncapture={handleKeydown} />

{#if generateTourState.isActive}
  <!-- Backdrop - click to skip -->
  <button
    class="tour-backdrop"
    onclick={handleSkip}
    aria-label="Skip tour"
    tabindex="-1"
  ></button>

  <!-- Floating tour card -->
  <div
    class="tour-card"
    role="dialog"
    aria-label="Generator settings tour"
  >
    {#if currentHelpContent}
      <div class="tour-icon" style:--icon-color={currentHelpContent.color}>
        <i class="fas {currentHelpContent.icon}" aria-hidden="true"></i>
      </div>

      <h3 class="tour-title">{currentHelpContent.name}</h3>
      <p class="tour-desc">{currentHelpContent.fullDesc}</p>

      {#if currentHelpContent.tip}
        <p class="tour-tip">
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
          {currentHelpContent.tip}
        </p>
      {/if}
    {/if}

    <!-- Step dots -->
    <div class="tour-dots" aria-label="Step {generateTourState.currentStopIndex + 1} of {generateTourState.totalStops}">
      {#each Array(generateTourState.totalStops) as _, i}
        <div
          class="dot"
          class:active={i === generateTourState.currentStopIndex}
          class:completed={i < generateTourState.currentStopIndex}
        ></div>
      {/each}
    </div>

    <!-- Actions -->
    <div class="tour-actions">
      <button class="skip-btn" onclick={handleSkip}>Skip</button>
      <button class="next-btn" onclick={handleNext}>
        {generateTourState.isLastStop ? "Got it" : "Next"}
        {#if !generateTourState.isLastStop}
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        {/if}
      </button>
    </div>
  </div>
{/if}

<style>
  .tour-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 200;
    border: none;
    cursor: pointer;
    padding: 0;
    animation: fadeIn var(--duration-normal, 200ms) ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .tour-card {
    position: fixed;
    bottom: max(env(safe-area-inset-bottom, 0px), 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 250;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 360px;
    width: calc(100% - 32px);
    padding: 20px 24px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--icon-color, #3b82f6) 25%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color, #3b82f6) 40%, transparent);
    color: var(--icon-color, #3b82f6);
    font-size: 1.1rem;
  }

  .tour-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
  }

  .tour-desc {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.5;
  }

  .tour-tip {
    margin: 0;
    font-size: 0.8rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    text-align: left;
    padding: 8px 10px;
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.15);
    border-radius: 8px;
  }

  .tour-tip i {
    color: #4ade80;
    flex-shrink: 0;
    margin-top: 1px;
    font-size: 0.75rem;
  }

  .tour-dots {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
  }

  .dot.active {
    background: var(--semantic-info, #3b82f6);
    transform: scale(1.2);
  }

  .dot.completed {
    background: rgba(255, 255, 255, 0.4);
  }

  .tour-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    width: 100%;
    justify-content: center;
  }

  .skip-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .skip-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.25);
    color: white;
  }

  .next-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-info, #3b82f6) 55%, transparent);
    border-radius: 8px;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .next-btn:hover {
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 50%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--semantic-info, #3b82f6) 25%, transparent);
  }

  .next-btn:active {
    transform: scale(0.97);
  }

  .next-btn i {
    font-size: 0.75rem;
  }

  /* Desktop: position card in center instead of bottom */
  @media (min-width: 1024px) {
    .tour-card {
      bottom: auto;
      top: 50%;
      transform: translateX(-50%) translateY(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tour-backdrop {
      animation: none;
    }
    .tour-card {
      animation: none;
    }
    .dot {
      transition: none;
    }
    .skip-btn,
    .next-btn {
      transition: none;
    }
    .next-btn:active {
      transform: none;
    }
  }
</style>
