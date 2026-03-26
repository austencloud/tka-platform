<!--
  FuseTour - Guided walkthrough for the Fuse tab.

  Highlights each section in turn: panels, shuffle, controls.
  Renders as a floating card overlay inside the fuse layout.
-->
<script lang="ts">
  import {
    fuseTourState,
    type FuseTourStop,
  } from "../../state/fuse-tour-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  interface StopInfo {
    id: FuseTourStop;
    icon: string;
    title: string;
    description: string;
    highlight: "all" | "left" | "right" | "shuffle" | "controls";
  }

  const STOP_INFO: StopInfo[] = [
    {
      id: "welcome",
      icon: "fa-fire",
      title: "Fuse",
      description:
        "Pick a blue prop path and a red prop path, then merge them into one complete sequence.",
      highlight: "all",
    },
    {
      id: "left-panel",
      icon: "fa-hand-point-left",
      title: "Blue Prop Path",
      description:
        "This side shows one blue prop path. The notation grid and animation below it both show the same path stepping in real time.",
      highlight: "left",
    },
    {
      id: "right-panel",
      icon: "fa-hand-point-right",
      title: "Red Prop Path",
      description:
        "Same idea for red. Both sides step together so you can see how the two paths line up.",
      highlight: "right",
    },
    {
      id: "shuffle",
      icon: "fa-shuffle",
      title: "Shuffle",
      description:
        "Tap the Shuffle button on either side to cycle through different prop paths until you find the combination you want.",
      highlight: "shuffle",
    },
    {
      id: "controls",
      icon: "fa-sliders-h",
      title: "Fuse It",
      description:
        "When you like what you see, hit Fuse to combine them. You can also adjust the beat count and playback speed down here.",
      highlight: "controls",
    },
  ];

  const currentStopInfo = $derived(
    STOP_INFO[fuseTourState.currentStopIndex] ?? STOP_INFO[0]!,
  );

  let hapticService: IHapticFeedback | null = null;
  try {
    hapticService = container.items.hapticFeedback;
  } catch {
    // Optional service
  }

  function handleNext() {
    hapticService?.trigger("selection");
    fuseTourState.advance();
  }

  function handleSkip() {
    hapticService?.trigger("selection");
    fuseTourState.skip();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!fuseTourState.isActive) return;
    if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNext();
    } else if (event.key === "ArrowLeft" && fuseTourState.currentStopIndex > 0) {
      event.preventDefault();
      fuseTourState.goBack();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleSkip();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if fuseTourState.isActive}
  <div
    class="tour-overlay"
    role="dialog"
    aria-label="Fuse tab tour"
  >
    <button
      class="tour-backdrop"
      onclick={handleSkip}
      aria-label="Skip tour"
      tabindex="-1"
    ></button>

    <div class="tour-card">
      <div class="tour-icon">
        <i class="fas {currentStopInfo.icon}" aria-hidden="true"></i>
      </div>

      <h3 class="tour-title">{currentStopInfo.title}</h3>
      <p class="tour-desc">{currentStopInfo.description}</p>

      <div class="tour-dots">
        {#each STOP_INFO as _, i}
          <div
            class="dot"
            class:active={i === fuseTourState.currentStopIndex}
            class:completed={i < fuseTourState.currentStopIndex}
          ></div>
        {/each}
      </div>

      <div class="tour-actions">
        <button class="skip-btn" onclick={handleSkip}>Skip</button>
        <button class="next-btn" onclick={handleNext}>
          {fuseTourState.isLastStop ? "Got it" : "Next"}
          {#if !fuseTourState.isLastStop}
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .tour-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .tour-card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 340px;
    width: calc(100% - 32px);
    padding: 24px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: color-mix(in srgb, #f97316 25%, transparent);
    border: 1px solid color-mix(in srgb, #f97316 40%, transparent);
    color: #f97316;
    font-size: 1.2rem;
  }

  .tour-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
  }

  .tour-desc {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    line-height: 1.55;
  }

  .tour-dots {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
  }

  .dot.active {
    background: #f97316;
    transform: scale(1.2);
  }

  .dot.completed {
    background: rgba(255, 255, 255, 0.4);
  }

  .tour-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 6px;
    width: 100%;
    justify-content: center;
  }

  .skip-btn {
    padding: 10px 20px;
    min-height: 44px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
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
    padding: 10px 24px;
    min-height: 44px;
    background: color-mix(in srgb, #f97316 40%, transparent);
    border: 1.5px solid color-mix(in srgb, #f97316 55%, transparent);
    border-radius: 8px;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .next-btn:hover {
    background: color-mix(in srgb, #f97316 50%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, #f97316 25%, transparent);
  }

  .next-btn:active {
    transform: scale(0.97);
  }

  .next-btn i {
    font-size: 0.75rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .tour-card {
      transition: none;
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
