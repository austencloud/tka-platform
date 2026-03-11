<!--
  DecomposeLayout.svelte

  Three-slot layout: hero canvas on top, two small tappable canvases below.
  Tapping a small canvas swaps it with the hero.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HandView } from "../state/decompose-state.svelte";
  import { getDecomposeContext } from "../context/decompose-context";

  interface Props {
    heroCanvas: Snippet;
    smallLeftCanvas: Snippet;
    smallRightCanvas: Snippet;
  }

  let { heroCanvas, smallLeftCanvas, smallRightCanvas }: Props = $props();
  const { slotState } = getDecomposeContext();

  function handleSmallClick(slot: "left" | "right") {
    slotState.swapWithHero(slot);
  }

  function viewLabel(view: HandView): string {
    if (view === "both") return "Both";
    if (view === "blue") return "Blue";
    return "Red";
  }

  function viewColor(view: HandView): string {
    if (view === "blue") return "var(--prop-blue, #2196f3)";
    if (view === "red") return "var(--prop-red, #f44336)";
    return "var(--theme-text, #fff)";
  }
</script>

<div class="decompose-layout">
  <div class="hero-slot">
    <div class="slot-label" style="color: {viewColor(slotState.heroView)}">
      {viewLabel(slotState.heroView)}
    </div>
    {@render heroCanvas()}
  </div>

  <div class="small-slots">
    <button
      class="small-slot"
      onclick={() => handleSmallClick("left")}
      aria-label="Swap {viewLabel(slotState.smallLeftView)} to hero"
    >
      <div class="slot-label" style="color: {viewColor(slotState.smallLeftView)}">
        {viewLabel(slotState.smallLeftView)}
      </div>
      {@render smallLeftCanvas()}
    </button>

    <button
      class="small-slot"
      onclick={() => handleSmallClick("right")}
      aria-label="Swap {viewLabel(slotState.smallRightView)} to hero"
    >
      <div class="slot-label" style="color: {viewColor(slotState.smallRightView)}">
        {viewLabel(slotState.smallRightView)}
      </div>
      {@render smallRightCanvas()}
    </button>
  </div>
</div>

<style>
  .decompose-layout {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    height: 100%;
    container-type: size;
  }

  .hero-slot {
    position: relative;
    flex: 2;
    min-height: 0;
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .small-slots {
    display: flex;
    gap: 8px;
    flex: 1;
    min-height: 0;
  }

  .small-slot {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    padding: 0;
    cursor: pointer;
    transition: border-color 300ms ease;
  }

  .small-slot:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .small-slot:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .slot-label {
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    z-index: 1;
    pointer-events: none;
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: reduce) {
    .small-slot {
      transition: none;
    }
  }
</style>
