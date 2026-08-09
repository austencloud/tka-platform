<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { AgXToneMapping, PCFSoftShadowMap } from "three";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import {
    TOTAL_LENGTH_M,
    WATERLINE_Y,
    legAt,
  } from "$lib/features/water-traverse/data/water-traverse-terrain";
  import WaterTraverseWalkScene from "./WaterTraverseWalkScene.svelte";

  let resetToken = $state(0);
  let position = $state({ x: 0, y: 1.28, z: 6 });

  const LEG_LABEL = {
    snowfield: "The frozen river",
    sea: "The trench",
    spring: "The steaming plain",
  } as const;

  const RELATIONSHIP = {
    snowfield: "on the water",
    sea: "under the water",
    spring: "in the water",
  } as const;

  const leg = $derived(legAt(position.z));
  const progress = $derived(
    Math.round((Math.min(position.z, TOTAL_LENGTH_M) / TOTAL_LENGTH_M) * 100)
  );
  /** Eye height against the one waterline the whole piece is measured from. */
  const relativeToLine = $derived(position.y - WATERLINE_Y);
</script>

<svelte:head>
  <title>Walk the Water Traverse</title>
  <meta
    name="description"
    content="First-person review of the Water Traverse: one waterline, walked on, under, and in."
  />
</svelte:head>

<main
  class="walk-page"
  data-player-x={position.x.toFixed(2)}
  data-player-y={position.y.toFixed(2)}
  data-player-z={position.z.toFixed(2)}
  data-leg={leg}
>
  <div class="viewport" aria-label="The Water Traverse, first person">
    <Canvas dpr={1} shadows={PCFSoftShadowMap} toneMapping={AgXToneMapping}>
      <WaterTraverseWalkScene
        {resetToken}
        onPositionChange={(next) => (position = next)}
      />
    </Canvas>
  </div>

  <header class="review-hud">
    <div class="review-label">
      <p>Water · spatial review</p>
      <h1>{LEG_LABEL[leg]}</h1>
      <span>
        You are <strong>{RELATIONSHIP[leg]}</strong> ·
        {relativeToLine >= 0 ? "+" : ""}{relativeToLine.toFixed(1)} m from the
        waterline
      </span>
      <div
        class="progress"
        role="img"
        aria-label={`${progress}% of the way along the traverse`}
      >
        <span style:inline-size={`${Math.max(0, Math.min(100, progress))}%`}
        ></span>
      </div>
    </div>
    <ActionButton
      label="Return to the snowfield"
      icon="fa-arrow-rotate-left"
      color="fuse"
      onclick={() => (resetToken += 1)}
    />
  </header>
</main>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #0a1a22;
  }

  .walk-page {
    --theme-accent: #7fd8ea;
    --theme-card-bg: rgba(6, 20, 26, 0.82);
    --theme-card-hover-bg: rgba(12, 34, 44, 0.92);
    --theme-stroke: rgba(186, 230, 253, 0.2);
    --theme-stroke-strong: rgba(127, 216, 234, 0.58);
    --theme-text: #ecfeff;
    --theme-text-on-accent: #03121a;
    --min-touch-target: 44px;
    --duration-normal: 160ms;
    position: fixed;
    inset: 0;
    min-inline-size: 20rem;
    overflow: hidden;
    color: var(--theme-text);
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  .viewport {
    position: absolute;
    inset: 0;
  }

  .review-hud {
    position: absolute;
    inset-block-start: clamp(0.8rem, 1.5vw, 1.5rem);
    inset-inline: clamp(0.8rem, 1.5vw, 1.5rem);
    z-index: 60;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    pointer-events: none;
  }

  .review-hud :global(button) {
    pointer-events: auto;
  }

  .review-label {
    min-inline-size: min(23rem, calc(100vw - 12rem));
    padding: 0.75rem 1rem 0.9rem;
    border: 1px solid rgba(186, 230, 253, 0.18);
    border-radius: 0.9rem;
    background: rgba(4, 14, 19, 0.72);
    box-shadow:
      0 1rem 3rem rgba(0, 0, 0, 0.34),
      inset 0 1px rgba(255, 255, 255, 0.035);
    backdrop-filter: blur(0.7rem);
  }

  .review-label p,
  .review-label h1 {
    margin: 0;
  }

  .review-label p {
    color: #7fd8ea;
    font-size: 0.72rem;
    font-weight: 760;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .review-label h1 {
    margin-block: 0.16rem 0.1rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.45rem, 1.8vw, 2.25rem);
    font-weight: 540;
    line-height: 1;
  }

  .review-label span {
    color: #a8c8d4;
    font-size: 0.88rem;
    /* The distance readout changes every frame; tabular digits keep the row
       from twitching as it counts. */
    font-variant-numeric: tabular-nums;
  }

  .review-label strong {
    color: #ecfeff;
    font-weight: 640;
  }

  .progress {
    margin-block-start: 0.6rem;
    block-size: 0.25rem;
    border-radius: 999px;
    background: rgba(186, 230, 253, 0.16);
  }

  .progress span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #cfe6ef, #7fd8ea 55%, #ffd9a0);
  }

  @media (min-width: 1680px) {
    .review-label {
      padding: 0.95rem 1.2rem 1.1rem;
    }

    .review-label p {
      font-size: 0.8rem;
    }

    .review-label span {
      font-size: 1rem;
    }
  }

  @media (min-width: 2600px) {
    .review-hud {
      inset-block-start: 2rem;
      inset-inline: 2rem;
    }

    .review-label {
      min-inline-size: 34rem;
      padding: 1.35rem 1.65rem 1.6rem;
      border-radius: 1.4rem;
    }

    .review-label p {
      font-size: 1.05rem;
    }

    .review-label h1 {
      margin-block: 0.28rem 0.2rem;
      font-size: 3.2rem;
    }

    .review-label span {
      font-size: 1.35rem;
    }

    .progress {
      block-size: 0.4rem;
    }

    .review-hud :global(button) {
      min-block-size: 4.25rem;
      padding: 1.15rem 2rem;
      border-radius: 1.6rem;
      font-size: 1.25rem;
    }
  }

  @media (max-width: 42rem) {
    .review-hud {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
