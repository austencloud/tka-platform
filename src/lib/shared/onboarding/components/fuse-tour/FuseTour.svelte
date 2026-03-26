<!--
  FuseTour - Fullscreen wizard walkthrough for the Fuse tab.

  Takes over the entire layout. Each stop shows only what's relevant.
  No overlays, no dimming — clean takeover.
-->
<script lang="ts">
  import {
    fuseTourState,
  } from "../../state/fuse-tour-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  interface StopContent {
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    buttonText: string;
  }

  const STOPS: StopContent[] = [
    {
      icon: "fa-fire",
      iconColor: "#f97316",
      title: "Fuse",
      description: "Combine a blue prop path and a red prop path into one complete sequence.",
      buttonText: "Show me",
    },
    {
      icon: "fa-circle",
      iconColor: "var(--prop-blue, #2196f3)",
      title: "Blue Prop Path",
      description: "This side shows one blue prop path. The notation grid shows the steps, and the animation below shows it in motion.",
      buttonText: "Next",
    },
    {
      icon: "fa-circle",
      iconColor: "var(--prop-red, #f44336)",
      title: "Red Prop Path",
      description: "Same for red. Both sides step in sync so you can see how they'll fit together.",
      buttonText: "Next",
    },
    {
      icon: "fa-shuffle",
      iconColor: "#f97316",
      title: "Try Shuffling",
      description: "Tap a Shuffle button below to see a different prop path.",
      buttonText: "",
    },
    {
      icon: "fa-fire",
      iconColor: "#f97316",
      title: "Fuse Them",
      description: "When you like both sides, tap Fuse to merge them into one sequence.",
      buttonText: "Got it",
    },
  ];

  const current = $derived(STOPS[fuseTourState.currentStopIndex] ?? STOPS[0]!);
  const isWaiting = $derived(fuseTourState.currentStop === "shuffle" && !fuseTourState.actionCompleted);

  let hapticService: IHapticFeedback | null = null;
  try {
    hapticService = container.items.hapticFeedback;
  } catch {}

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
    if (event.key === "Escape") {
      event.preventDefault();
      handleSkip();
    } else if (!isWaiting && (event.key === "Enter" || event.key === " " || event.key === "ArrowRight")) {
      event.preventDefault();
      handleNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      fuseTourState.goBack();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if fuseTourState.isActive}
  <div class="tour-content">
    <div class="tour-icon" style="--icon-color: {current.iconColor};">
      <i class="fas {current.icon}" aria-hidden="true"></i>
    </div>

    <h3 class="tour-title">{current.title}</h3>
    <p class="tour-desc">{current.description}</p>

    <div class="tour-dots">
      {#each STOPS as _, i}
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
          Shuffle to continue
        </span>
      {:else if current.buttonText}
        <button class="next-btn" onclick={handleNext}>
          {current.buttonText}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tour-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 32px 24px;
    text-align: center;
    height: 100%;
    width: 100%;
  }

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--icon-color) 20%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--icon-color) 35%, transparent);
    color: var(--icon-color);
    font-size: 1.5rem;
  }

  .tour-title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: white;
  }

  .tour-desc {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    line-height: 1.6;
    max-width: 300px;
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
    transform: scale(1.25);
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
    padding: 12px 24px;
    min-height: 48px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
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
    padding: 12px 28px;
    min-height: 48px;
    background: linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .next-btn:hover {
    filter: brightness(1.1);
  }

  .next-btn:active {
    transform: scale(0.97);
  }

  .waiting-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    min-height: 48px;
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
    .dot { transition: none; }
    .skip-btn, .next-btn { transition: none; }
    .next-btn:active { transform: none; }
    .waiting-hint { animation: none; opacity: 1; }
  }
</style>
