<!--
  LandingBeatGrid.svelte

  Displays a sequence as a grid of pictographs alongside the animation.
  Uses @tka/pictograph pipeline to prepare and render each beat.
  Highlights the currently playing step in sync with the animation.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { StepData } from "@tka/types";
  import {
    createPictographPipeline,
    setPictographConfig,
    type PictographConfig,
    type PreparedPictographData,
    PictographRenderer,
    beatDataToPictographData,
  } from "@tka/pictograph";

  let {
    steps = [],
    currentStepIndex = 0,
    darkMode = true,
    propType = "staff",
  } = $props<{
    steps: StepData[];
    currentStepIndex: number;
    darkMode?: boolean;
    propType?: string;
  }>();

  let preparedSteps: PreparedPictographData[] = $state([]);
  let preparing = $state(false);

  const config: PictographConfig = {
    getBluePropType: () => propType,
    getRedPropType: () => propType,
    getDarkMode: () => darkMode,
    assetBasePath: "",
  };

  setPictographConfig(config);

  const pipeline = createPictographPipeline(config);

  // Re-prepare when steps or prop type changes
  let lastPrepareKey = "";

  $effect(() => {
    const key = `${steps.map((s: StepData) => s.id).join(",")}|${propType}|${darkMode}`;
    if (key === lastPrepareKey || steps.length === 0) return;
    lastPrepareKey = key;
    prepareAll();
  });

  async function prepareAll() {
    if (steps.length === 0) return;
    preparing = true;

    try {
      pipeline.preparer.clearCache();
      const pictographs = steps.map((s: StepData) => beatDataToPictographData(s));
      preparedSteps = await pipeline.preparer.prepareBatch(pictographs, {
        bluePropType: propType,
        redPropType: propType,
        themeMode: darkMode ? "dark" : "light",
      });
    } catch (e) {
      console.error("Failed to prepare pictographs:", e);
      preparedSteps = [];
    } finally {
      preparing = false;
    }
  }

  let gridContainer: HTMLDivElement | undefined = $state();
</script>

<div class="beat-grid" bind:this={gridContainer} style="--beat-count: {preparedSteps.length || steps.length || 4}">
  {#if preparing && preparedSteps.length === 0}
    <div class="loading">
      <div class="spinner"></div>
    </div>
  {:else if preparedSteps.length > 0}
    <div class="grid-cells">
      {#each preparedSteps as prepared, i (prepared.id ?? i)}
        <div
          class="cell"
          class:active={i === currentStepIndex}
          data-step={i}
        >
          <PictographRenderer
            pictograph={prepared}
            showGrid={true}
            showTKA={true}
            showReversals={false}
            showVTG={false}
            showElemental={false}
            showPositions={false}
            showStepNumber={true}
            stepNumber={i + 1}
            {darkMode}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .beat-grid {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .beat-grid::-webkit-scrollbar {
    width: 6px;
  }

  .beat-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .beat-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .grid-cells {
    display: grid;
    grid-template-columns: repeat(var(--beat-count, 4), 1fr);
    gap: 4px;
    padding: 4px;
  }

  .cell {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .cell.active {
    border-color: #6366f1;
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition: none;
    }

    .spinner {
      animation: none;
    }
  }
</style>
