<!--
  FuseTour - Guided walkthrough for the Fuse tab.

  Tour card positioning:
  - Welcome: centered overlay (both panels visible)
  - Left panel: card replaces the right panel slot
  - Right panel: card replaces the left panel slot
  - Shuffle: card centered, both panels visible, waits for user to shuffle
  - Controls: card centered, only fuse button highlighted
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
    /** Text for the action button — null means use default "Next" / "Got it" */
    actionText?: string;
    /** If true, the stop waits for an external signal (shuffle) before enabling Next */
    waitForAction?: boolean;
  }

  const STOP_INFO: StopInfo[] = [
    {
      id: "welcome",
      icon: "fa-fire",
      title: "Fuse",
      description:
        "Combine two prop paths into one sequence. You'll pick a blue path and a red path, then merge them.",
    },
    {
      id: "left-panel",
      icon: "fa-circle",
      title: "Blue Prop Path",
      description:
        "This shows one blue prop path. The notation grid shows the steps, and the animation below shows it in motion.",
    },
    {
      id: "right-panel",
      icon: "fa-circle",
      title: "Red Prop Path",
      description:
        "Same for the red prop. Both sides step in sync so you can see how they'll fit together.",
    },
    {
      id: "shuffle",
      icon: "fa-shuffle",
      title: "Try Shuffling",
      description:
        "Tap one of the Shuffle buttons to see a different prop path. Keep shuffling until you find a combination you like.",
      actionText: "Shuffle to continue",
      waitForAction: true,
    },
    {
      id: "controls",
      icon: "fa-fire",
      title: "Fuse Them Together",
      description:
        "When you're happy with both sides, tap the Fuse button to merge them into a single sequence.",
      actionText: "Got it",
    },
  ];

  const currentStopInfo = $derived(
    STOP_INFO[fuseTourState.currentStopIndex] ?? STOP_INFO[0]!,
  );

  const isWaiting = $derived(currentStopInfo.waitForAction && !fuseTourState.actionCompleted);

  let hapticService: IHapticFeedback | null = null;
  try {
    hapticService = container.items.hapticFeedback;
  } catch {
    // Optional service
  }

  function handleNext() {
    if (isWaiting) return;
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
    } else if (event.key === "ArrowLeft") {
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
  <div class="tour-card">
    <div class="tour-icon" class:blue={currentStopInfo.id === "left-panel"} class:red={currentStopInfo.id === "right-panel"}>
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
      {#if isWaiting}
        <span class="waiting-hint">
          <i class="fas fa-hand-pointer" aria-hidden="true"></i>
          {currentStopInfo.actionText}
        </span>
      {:else}
        <button class="next-btn" onclick={handleNext}>
          {currentStopInfo.actionText ?? (fuseTourState.isLastStop ? "Got it" : "Next")}
          {#if !fuseTourState.isLastStop && !currentStopInfo.actionText}
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
          {/if}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tour-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 28px 24px;
    text-align: center;
    height: 100%;
    animation: tourFadeIn 0.3s ease;
  }

  @keyframes tourFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: color-mix(in srgb, #f97316 25%, transparent);
    border: 1.5px solid color-mix(in srgb, #f97316 40%, transparent);
    color: #f97316;
    font-size: 1.4rem;
  }

  .tour-icon.blue {
    background: color-mix(in srgb, var(--prop-blue, #2196f3) 25%, transparent);
    border-color: color-mix(in srgb, var(--prop-blue, #2196f3) 40%, transparent);
    color: var(--prop-blue, #2196f3);
  }

  .tour-icon.red {
    background: color-mix(in srgb, var(--prop-red, #f44336) 25%, transparent);
    border-color: color-mix(in srgb, var(--prop-red, #f44336) 40%, transparent);
    color: var(--prop-red, #f44336);
  }

  .tour-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: white;
  }

  .tour-desc {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    line-height: 1.6;
    max-width: 280px;
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
    margin-top: 8px;
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

  .waiting-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    min-height: 44px;
    color: #f97316;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tour-card { animation: none; }
    .dot { transition: none; }
    .skip-btn, .next-btn { transition: none; }
    .next-btn:active { transform: none; }
    .waiting-hint { animation: none; opacity: 1; }
  }
</style>
