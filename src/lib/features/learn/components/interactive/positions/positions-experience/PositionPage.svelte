<!--
PositionPage - Single position type learning page.
The pictograph IS the lesson. Transform buttons are the primary interaction.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import {
    POSITION_INFO,
    type HandPosition,
    type PositionExample,
  } from "../../../../domain/constants/positions-experience-data";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { setGridRotationDirection } from "$lib/shared/pictograph/grid/state/grid-rotation-state.svelte";
  import PositionVisualizer from "../PositionVisualizer.svelte";

  let {
    type,
    examples,
    isFirst = false,
    isLast = false,
    onNext,
    onBack,
  }: {
    type: "alpha" | "beta" | "gamma";
    examples: readonly PositionExample[];
    isFirst?: boolean;
    isLast?: boolean;
    onNext: () => void;
    onBack: () => void;
  } = $props();

  const hapticService = container.items.hapticFeedback;
  const info = $derived(POSITION_INFO[type]);

  // Mutable transform state — starts from first example, reset when position type changes
  let leftHand = $state<HandPosition>("N");
  let rightHand = $state<HandPosition>("S");
  let gridMode = $state<GridMode>(GridMode.DIAMOND);

  $effect(() => {
    const start = examples[0]!;
    leftHand = start.left;
    rightHand = start.right;
    gridMode = start.gridMode;
  });

  // =========================================================================
  // Transform logic — pure compass-point maps
  // =========================================================================
  const POSITIONS_CW: HandPosition[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  function rotateCW(pos: HandPosition): HandPosition {
    const idx = POSITIONS_CW.indexOf(pos);
    return POSITIONS_CW[(idx + 1) % 8]!;
  }

  const MIRROR_MAP: Record<HandPosition, HandPosition> = {
    N: "N", S: "S", E: "W", W: "E",
    NE: "NW", NW: "NE", SE: "SW", SW: "SE",
  };

  function handleRotate() {
    leftHand = rotateCW(leftHand);
    rightHand = rotateCW(rightHand);
    setGridRotationDirection(1);
    gridMode = gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
    hapticService?.trigger("selection");
  }

  function handleMirror() {
    leftHand = MIRROR_MAP[leftHand];
    rightHand = MIRROR_MAP[rightHand];
    hapticService?.trigger("selection");
  }

  function handleSwap() {
    const tmp = leftHand;
    leftHand = rightHand;
    rightHand = tmp;
    hapticService?.trigger("selection");
  }
</script>

<div class="page">
  <div class="header anim-item" style="--anim-order: 0">
    <span class="symbol">{info.symbol}</span>
    <h2>{info.name}</h2>
  </div>

  <div class="visualizer-section">
    <PositionVisualizer
      {leftHand}
      {rightHand}
      {gridMode}
      showLetter={true}
    />

    <div class="transform-row">
      <button class="transform-button" onclick={handleRotate}>
        <span class="transform-icon rotate">
          <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        </span>
        <span class="transform-label">Rotate</span>
      </button>
      <button class="transform-button" onclick={handleMirror}>
        <span class="transform-icon mirror">
          <i class="fa-solid fa-left-right" aria-hidden="true"></i>
        </span>
        <span class="transform-label">Mirror</span>
      </button>
      <button class="transform-button" onclick={handleSwap}>
        <span class="transform-icon swap">
          <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
        </span>
        <span class="transform-label">Swap</span>
      </button>
    </div>
  </div>

  <p class="description anim-item" style="--anim-order: 1">
    In {info.name}, {info.summary.charAt(0).toLowerCase()}{info.summary.slice(1)}
  </p>

  <div class="navigation-area">
    {#if !isFirst}
      <button class="nav-button back-button" onclick={onBack}>
        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        Back
      </button>
    {/if}
    <button class="nav-button next-button" onclick={onNext}>
      {#if isLast}
        Take the Quiz
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      {:else}
        Next
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      {/if}
    </button>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    max-width: 700px;
    width: 100%;
    flex: 1;
  }

  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .symbol {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    color: var(--theme-text);
  }

  h2 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
  }

  .description {
    font-size: 1.125rem;
    font-style: italic;
    color: var(--theme-text-dim);
    text-align: center;
    margin: 0;
    line-height: 1.4;
  }

  .visualizer-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .transform-row {
    display: flex;
    gap: 0.625rem;
    width: 100%;
    max-width: 360px;
  }

  .transform-button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
    min-height: var(--min-touch-target, 44px);
  }

  .transform-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .transform-button:active {
    transform: scale(0.95);
  }

  .transform-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 1rem;
  }

  .transform-icon.rotate {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
  }

  .transform-icon.mirror {
    background: rgba(34, 211, 238, 0.2);
    color: #22d3ee;
  }

  .transform-icon.swap {
    background: rgba(251, 146, 60, 0.2);
    color: #fb923c;
  }

  .transform-label {
    font-weight: 600;
  }

  .navigation-area {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
    min-height: var(--min-touch-target, 44px);
  }

  .back-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim);
  }

  .back-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
  }

  .next-button {
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 40%, transparent);
    border: 2px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 60%, transparent);
    color: white;
  }

  .next-button:hover {
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 50%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #22d3ee) 80%, transparent);
  }

  .nav-button:active {
    transform: scale(0.97);
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-button,
    .transform-button {
      transition: none;
    }
  }
</style>
