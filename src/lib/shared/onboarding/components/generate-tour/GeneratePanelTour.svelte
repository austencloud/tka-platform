<!--
  GeneratePanelTour - Guided tour overlay for the generate panel.

  Renders as a fixed overlay with a dark backdrop. Highlights one card
  at a time and shows a floating explanation card with the full rich
  content from generator-help-content (images, bullets, tips).
  Customize and LOOP get custom brief tour descriptions.
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
    "word-input": "generation-mode",
    "length": "length",
    "level": "level",
    "grid-mode": "grid-mode",
    "turn-intensity": "turn-intensity",
    "customize": "prop-continuity",
    "loop": "loop-type",
    "slice-size": "slice-size",
    "generate-button": "generate",
  };

  // Tour-specific overrides for stops that should be brief
  // rather than showing the full detailed help content
  const tourOverrides: Partial<Record<GenerateTourStop, Partial<GeneratorHelpItem>>> = {
    "word-input": {
      name: "Spell a Word",
      fullDesc: "Type a word and the generator turns each letter into a move. Leave it blank for a random sequence.",
      bullets: undefined,
      images: undefined,
      tip: "Try your name, or a short word like FLOW.",
    },
    "customize": {
      name: "Customize",
      icon: "fa-sliders",
      fullDesc: "Tweak how your sequence feels. Prop continuity, rhythm templates, and start/end positions all live here.",
      bullets: undefined,
      images: undefined,
      tip: "Play around with these after you've generated a few sequences.",
    },
    "loop": {
      name: "LOOP",
      fullDesc: "A LOOP sequence ends where it started, so you can repeat it forever. There are 6 LOOP types that each create a different return pattern.",
      bullets: [
        "Rotated, Mirrored, Swapped, Inverted, and combinations",
        "The second half transforms the first half to bring you back",
      ],
      images: undefined,
      tip: "Turn it on and try it. You'll see.",
    },
  };

  // Merge base help content with any tour overrides
  const currentContent = $derived.by((): GeneratorHelpItem | undefined => {
    const stop = generateTourState.currentStop;
    const helpId = stopToHelpId[stop];
    const base = generatorHelpContent.find((c) => c.id === helpId);
    if (!base) return undefined;

    const override = tourOverrides[stop];
    if (!override) return base;

    return { ...base, ...override } as GeneratorHelpItem;
  });

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
    {#if currentContent}
      {@const color = currentContent.color}

      <!-- Header: icon + title + subtitle -->
      <div class="tour-header">
        <div class="tour-icon" style:--icon-color={color}>
          <i class="fas {currentContent.icon}" aria-hidden="true"></i>
        </div>
        <div class="tour-header-text">
          <h3 class="tour-title">{currentContent.name}</h3>
          <p class="tour-subtitle">{currentContent.shortDesc}</p>
        </div>
      </div>

      <!-- Scrollable content area -->
      <div class="tour-content">
        <!-- Description -->
        <p class="tour-desc">{currentContent.fullDesc}</p>

        <!-- Images grid (e.g. level screenshots) -->
        {#if currentContent.images && currentContent.images.length > 0}
          <div class="image-grid">
            {#each currentContent.images as image}
              <figure class="image-item">
                <img src={image.src} alt={image.label} />
                <figcaption>{image.label}</figcaption>
              </figure>
            {/each}
          </div>
        {/if}

        <!-- Bullet points -->
        {#if currentContent.bullets && currentContent.bullets.length > 0}
          <ul class="bullet-list" style:--bullet-color={color}>
            {#each currentContent.bullets as bullet}
              <li>{bullet}</li>
            {/each}
          </ul>
        {/if}

        <!-- Tip -->
        {#if currentContent.tip}
          <div class="tour-tip">
            <i class="fas fa-lightbulb" aria-hidden="true"></i>
            <span>{currentContent.tip}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Footer: dots + actions -->
    <div class="tour-footer">
      <div class="tour-dots" aria-label="Step {generateTourState.currentStopIndex + 1} of {generateTourState.totalStops}">
        {#each Array(generateTourState.totalStops) as _, i}
          <div
            class="dot"
            class:active={i === generateTourState.currentStopIndex}
            class:completed={i < generateTourState.currentStopIndex}
          ></div>
        {/each}
      </div>

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
    /* Anchor to left side, vertically centered */
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 250;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 340px;
    width: calc(100% - 32px);
    max-height: 80vh;
    padding: 16px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    animation: slideIn var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  /* Mobile: bottom-anchored sheet style */
  @media (max-width: 1023px) {
    .tour-card {
      left: 50%;
      top: auto;
      bottom: max(env(safe-area-inset-bottom, 0px), 12px);
      transform: translateX(-50%);
      max-width: 400px;
      max-height: 55vh;
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
  }

  /* Header */
  .tour-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--icon-color, #3b82f6) 25%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color, #3b82f6) 40%, transparent);
    color: var(--icon-color, #3b82f6);
    font-size: 1rem;
  }

  .tour-header-text {
    min-width: 0;
  }

  .tour-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: white;
    line-height: 1.2;
  }

  .tour-subtitle {
    margin: 2px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.2;
  }

  /* Scrollable content */
  .tour-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    max-height: 50vh;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  @media (max-width: 1023px) {
    .tour-content {
      max-height: 35vh;
    }
  }

  .tour-desc {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
  }

  /* Images grid */
  .image-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .image-item {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .image-item img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .image-item figcaption {
    font-size: var(--font-size-xs, 11px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    line-height: 1.2;
  }

  /* Bullet list */
  .bullet-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bullet-list li {
    position: relative;
    padding-left: 16px;
    font-size: var(--font-size-min, 14px);
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .bullet-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 7px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--bullet-color, #3b82f6);
  }

  /* Tip box */
  .tour-tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.15);
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .tour-tip i {
    color: #4ade80;
    flex-shrink: 0;
    margin-top: 1px;
    font-size: 0.7rem;
  }

  /* Footer */
  .tour-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tour-dots {
    display: flex;
    gap: 5px;
  }

  .dot {
    width: 7px;
    height: 7px;
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
    gap: 10px;
    width: 100%;
    justify-content: center;
  }

  .skip-btn {
    padding: 7px 14px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.8rem;
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
    padding: 7px 18px;
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-info, #3b82f6) 55%, transparent);
    border-radius: 8px;
    color: white;
    font-size: 0.8rem;
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
    font-size: 0.7rem;
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
