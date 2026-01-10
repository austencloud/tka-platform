<!--
PositionPage - Single position type learning page
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
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

  const hapticService = container.items.hapticFeedback as IHapticFeedback;
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
  <h2>{info.name} Position</h2>

  <PositionIntroCard {type} {info} />

  <div class="visualizer-section">
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

  <PositionExplanation {info} />

  {#if showSummary}
    <PositionSummaryCards />
  {/if}

  <button class="next-button" onclick={onNext}>
    {#if showSummary}
      <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
      Take the Quiz
    {:else}
      Next
    {/if}
  </button>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
    animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0;
    text-align: center;
    background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
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
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cycle-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .next-button {
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 1rem 3rem;
    background: linear-gradient(
      135deg,
      rgba(34, 211, 238, 0.3) 0%,
      rgba(6, 182, 212, 0.3) 100%
    );
    border: 2px solid rgba(34, 211, 238, 0.5);
    border-radius: 12px;
    color: white;
    font-size: 1.125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;
    min-height: var(--min-touch-target, 44px);
    margin-top: 1rem;
  }

  .next-button:hover {
    background: linear-gradient(
      135deg,
      rgba(34, 211, 238, 0.4) 0%,
      rgba(6, 182, 212, 0.4) 100%
    );
    border-color: rgba(34, 211, 238, 0.8);
    transform: translateY(-2px);
  }

  .next-button i {
    font-size: 1rem;
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }

    .next-button {
      width: 100%;
      max-width: 300px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
