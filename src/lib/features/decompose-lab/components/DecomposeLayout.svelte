<!--
  DecomposeLayout.svelte

  Seamless three-canvas layout: hero canvas on top (2/3 height),
  two small canvases below (1/3 height, side by side). No borders
  between them — looks like one cohesive unit. Tapping a small
  canvas swaps it with the hero.
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
</script>

<div class="decompose-layout">
  <div class="hero-slot">
    {@render heroCanvas()}
  </div>

  <div class="small-slots">
    <button
      class="small-slot"
      onclick={() => handleSmallClick("left")}
      aria-label="Swap {viewLabel(slotState.smallLeftView)} to hero"
    >
      {@render smallLeftCanvas()}
    </button>

    <button
      class="small-slot"
      onclick={() => handleSmallClick("right")}
      aria-label="Swap {viewLabel(slotState.smallRightView)} to hero"
    >
      {@render smallRightCanvas()}
    </button>
  </div>
</div>

<style>
  .decompose-layout {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .hero-slot {
    position: relative;
    flex: 2;
    min-height: 0;
    overflow: hidden;
  }

  .small-slots {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .small-slot {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: opacity 300ms ease;
  }

  .small-slot:hover {
    opacity: 0.85;
  }

  .small-slot:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .small-slot {
      transition: none;
    }
  }
</style>
