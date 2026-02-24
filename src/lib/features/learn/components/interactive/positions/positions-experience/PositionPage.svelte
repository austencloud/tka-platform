<!--
PositionPage - Single position type learning page
Uses staggered entrance animations matching the Grid lesson's polish.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import {
    POSITION_INFO,
    type HandPosition,
    type PositionExample,
  } from "../../../../domain/constants/positions-experience-data";
  import PositionVisualizer from "../PositionVisualizer.svelte";
  import PositionIntroCard from "./PositionIntroCard.svelte";
  import PositionExplanation from "./PositionExplanation.svelte";
  import PositionSummaryCards from "./PositionSummaryCards.svelte";

  let {
    type,
    examples,
    showSummary = false,
    onNext,
  }: {
    type: "alpha" | "beta" | "gamma";
    examples: readonly PositionExample[];
    showSummary?: boolean;
    onNext: () => void;
  } = $props();

  const hapticService = container.items.hapticFeedback;
  const info = $derived(POSITION_INFO[type]);

  // State - initialized with defaults, $effect below syncs from props
  let leftHand = $state<HandPosition>("N");
  let rightHand = $state<HandPosition>("N");
  let exampleIndex = $state(0);

  // Sync from examples prop
  $effect(() => {
    const example = examples[0];
    if (example) {
      leftHand = example.left;
      rightHand = example.right;
    }
    exampleIndex = 0;
  });

  function cycleExample() {
    exampleIndex = (exampleIndex + 1) % examples.length;
    const example = examples[exampleIndex]!;
    leftHand = example.left;
    rightHand = example.right;
    hapticService?.trigger("selection");
  }
</script>

<div class="page">
  <h2 class="anim-item" style="--anim-order: 0">{info.name} Position</h2>

  <div class="anim-item" style="--anim-order: 1">
    <PositionIntroCard {info} />
  </div>

  <div class="visualizer-section anim-item" style="--anim-order: 2">
    <PositionVisualizer
      bind:leftHand
      bind:rightHand
      highlightType={type}
      showLabels={true}
    />
    <button class="cycle-button" onclick={cycleExample}>
      <i class="fa-solid fa-shuffle" aria-hidden="true"></i>
      Show Another Example
    </button>
  </div>

  <div class="anim-item" style="--anim-order: 3">
    <PositionExplanation {info} />
  </div>

  {#if showSummary}
    <div class="anim-item" style="--anim-order: 4">
      <PositionSummaryCards />
    </div>
  {/if}

  <div class="navigation-area anim-item" style="--anim-order: {showSummary ? 5 : 4}">
    <button class="next-button" onclick={onNext}>
      {#if showSummary}
        <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        Take the Quiz
      {:else}
        Next
      {/if}
    </button>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
  }

  h2 {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .visualizer-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cycle-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
  }

  .cycle-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
  }

  .navigation-area {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .next-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 1rem 3rem;
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 40%, transparent);
    border: 2px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1.125rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    min-width: 160px;
    min-height: var(--min-touch-target, 44px);
  }

  .next-button:hover {
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 50%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #22d3ee) 80%, transparent);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--theme-accent, #22d3ee) 30%, transparent);
  }

  .next-button:active {
    transform: scale(0.98);
  }

  .next-button i {
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    h2 {
      font-size: 2rem;
    }

    .next-button {
      padding: 0.875rem 2.5rem;
      font-size: 1rem;
      width: 100%;
      max-width: 300px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .next-button,
    .cycle-button {
      transition: none;
    }
  }
</style>
