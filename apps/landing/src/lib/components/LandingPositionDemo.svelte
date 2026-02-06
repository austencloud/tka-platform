<!--
  LandingPositionDemo.svelte

  Renders three static pictographs showing Alpha, Beta, and Gamma positions
  with hand props. Grid + props only, no arrows, no glyphs.
-->
<script lang="ts">
  import type { PictographData } from "@tka/types";
  import { PropType } from "@tka/types";
  import {
    createPictographPipeline,
    setPictographConfig,
    type PictographConfig,
    type PreparedPictographData,
    PictographRenderer,
  } from "@tka/pictograph";

  let {
    darkMode = true,
  } = $props<{
    darkMode?: boolean;
  }>();

  let prepared: PreparedPictographData[] = $state([]);
  let preparing = $state(false);

  const POSITION_LABELS = ["Alpha", "Beta", "Gamma"];
  const POSITION_DESCRIPTIONS = [
    "Hands opposite",
    "Hands together",
    "Hands at right angles",
  ];

  const config: PictographConfig = {
    getBluePropType: () => "hand",
    getRedPropType: () => "hand",
    getDarkMode: () => darkMode,
    assetBasePath: "",
  };

  setPictographConfig(config);
  const pipeline = createPictographPipeline(config);

  // Create minimal motion data for a static hand at a grid location
  function staticHandMotion(color: "blue" | "red", location: string) {
    return {
      motionType: "static",
      rotationDirection: "noRotation",
      startLocation: location,
      endLocation: location,
      turns: 0,
      startOrientation: "in",
      endOrientation: "in",
      isVisible: true,
      propType: "hand",
      arrowLocation: location,
      color,
      gridMode: "diamond",
      arrowPlacementData: {
        positionX: 0,
        positionY: 0,
        rotationAngle: 0,
        coordinates: null,
        svgCenter: null,
        svgMirrored: false,
      },
      propPlacementData: {
        positionX: 0,
        positionY: 0,
        rotationAngle: 0,
        coordinates: null,
        svgCenter: null,
      },
    };
  }

  // Three position pictographs: Alpha (N/S), Beta (N/N), Gamma (N/E)
  const positionPictographs: PictographData[] = [
    {
      id: "pos-alpha",
      letter: "α",
      startPosition: "alpha1",
      endPosition: "alpha1",
      gridMode: "diamond",
      motions: {
        blue: staticHandMotion("blue", "n"),
        red: staticHandMotion("red", "s"),
      },
    } as PictographData,
    {
      id: "pos-beta",
      letter: "β",
      startPosition: "beta1",
      endPosition: "beta1",
      gridMode: "diamond",
      motions: {
        blue: staticHandMotion("blue", "n"),
        red: staticHandMotion("red", "n"),
      },
    } as PictographData,
    {
      id: "pos-gamma",
      letter: "γ",
      startPosition: "gamma1",
      endPosition: "gamma1",
      gridMode: "diamond",
      motions: {
        blue: staticHandMotion("blue", "n"),
        red: staticHandMotion("red", "e"),
      },
    } as PictographData,
  ];

  let lastPrepareKey = "";

  $effect(() => {
    const key = `${darkMode}`;
    if (key === lastPrepareKey) return;
    lastPrepareKey = key;
    prepareAll();
  });

  async function prepareAll() {
    preparing = true;
    try {
      pipeline.preparer.clearCache();
      prepared = await pipeline.preparer.prepareBatch(positionPictographs, {
        bluePropType: PropType.HAND,
        redPropType: PropType.HAND,
        themeMode: darkMode ? "dark" : "light",
      });
    } catch (e) {
      console.error("Failed to prepare position pictographs:", e);
      prepared = [];
    } finally {
      preparing = false;
    }
  }
</script>

<div class="position-demo">
  {#if prepared.length > 0}
    <div class="position-grid">
      {#each prepared as pictograph, i (pictograph.id ?? i)}
        <div class="position-card">
          <div class="pictograph-cell">
            <PictographRenderer
              {pictograph}
              showGrid={true}
              showTKA={false}
              showReversals={false}
              showVTG={false}
              showElemental={false}
              showPositions={false}
              showStepNumber={false}
              {darkMode}
            />
          </div>
          <div class="position-label">
            <strong>{POSITION_LABELS[i]}</strong>
            <span>{POSITION_DESCRIPTIONS[i]}</span>
          </div>
        </div>
      {/each}
    </div>
  {:else if preparing}
    <div class="loading">
      <div class="spinner"></div>
    </div>
  {/if}
</div>

<style>
  .position-demo {
    width: 100%;
  }

  .position-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    max-width: 720px;
    margin: 0 auto;
  }

  .position-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .pictograph-cell {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .position-label {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .position-label strong {
    font-size: 1rem;
    font-weight: 600;
  }

  .position-label span {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
  }

  .loading {
    display: flex;
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

  @media (max-width: 500px) {
    .position-grid {
      gap: 12px;
    }

    .position-label strong {
      font-size: 0.875rem;
    }

    .position-label span {
      font-size: 0.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
