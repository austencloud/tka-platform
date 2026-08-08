<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { AgXToneMapping, PCFSoftShadowMap } from "three";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { buildEarthCanyonBlenderContract } from "$lib/features/museum/data/earth-canyon-blender-contract";
  import EarthRootChasmWalkScene from "./EarthRootChasmWalkScene.svelte";

  const contract = buildEarthCanyonBlenderContract();
  const labels = [
    { name: "Fire threshold", point: contract.route.fireEntry.plan },
    { name: "Canyon reveal", point: contract.route.reveal.plan },
    { name: "Fallen overlook", point: contract.route.slabOverlook.plan },
    { name: "Air climb", point: contract.route.airExit.plan },
  ];

  let assetReady = $state(false);
  let resetToken = $state(0);
  let position = $state({
    x: contract.route.fireEntry.plan.x,
    y: contract.route.fireEntry.elevation + 0.85,
    z: contract.route.fireEntry.plan.z,
  });

  const locationLabel = $derived.by(() => {
    return labels.reduce((closest, candidate) => {
      const closestDistance = Math.hypot(
        position.x - closest.point.x,
        position.z - closest.point.z
      );
      const candidateDistance = Math.hypot(
        position.x - candidate.point.x,
        position.z - candidate.point.z
      );
      return candidateDistance < closestDistance ? candidate : closest;
    }).name;
  });
</script>

<svelte:head>
  <title>Walk the Earth Root Chasm graybox</title>
  <meta
    name="description"
    content="First-person spatial review of the Blender-authored Earth Root Chasm graybox."
  />
</svelte:head>

<main
  class="walk-page"
  data-player-x={position.x.toFixed(3)}
  data-player-y={position.y.toFixed(3)}
  data-player-z={position.z.toFixed(3)}
  data-performer-count={contract.performers.length}
  data-asset-ready={assetReady}
>
  <div class="viewport" aria-label="Earth Root Chasm first-person graybox">
    <Canvas dpr={1} shadows={PCFSoftShadowMap} toneMapping={AgXToneMapping}>
      <EarthRootChasmWalkScene
        {resetToken}
        onAssetReady={() => (assetReady = true)}
        onPositionChange={(nextPosition) => (position = nextPosition)}
      />
    </Canvas>
  </div>

  <header class="review-hud">
    <div class="review-label">
      <p>Vulcan Cave spatial review</p>
      <h1>The Weight</h1>
      <span>{locationLabel}</span>
    </div>
    <ActionButton
      label="Reset to Fire"
      icon="fa-arrow-rotate-left"
      color="fuse"
      onclick={() => (resetToken += 1)}
    />
  </header>

  {#if !assetReady}
    <div class="loading" role="status" aria-live="polite">
      <span class="loading-mark" aria-hidden="true"></span>
      <div>
        <strong>Opening the chasm</strong>
        <span>Loading the Blender graybox</span>
      </div>
    </div>
  {/if}

  <aside class="ensemble-note" aria-label="Earth ensemble">
    <strong>G · H · I</strong>
    <span>Three performers, six metres below</span>
  </aside>

  <aside class="walk-note">
    <strong>Walk the route</strong>
    <span
      >Click the room, then use WASD and the mouse. Shift sprints. Esc releases
      the cursor.</span
    >
  </aside>
</main>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #050804;
  }

  .walk-page {
    --theme-accent: #84a84a;
    --theme-card-bg: rgba(8, 13, 7, 0.84);
    --theme-stroke: rgba(216, 231, 184, 0.2);
    --theme-text: #f4f7e9;
    --min-touch-target: 44px;
    position: fixed;
    inset: 0;
    min-inline-size: 20rem;
    overflow: hidden;
    color: var(--theme-text);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
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

  .review-label,
  .walk-note,
  .ensemble-note,
  .loading {
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    box-shadow:
      0 1rem 3rem rgba(0, 0, 0, 0.34),
      inset 0 1px rgba(255, 255, 255, 0.035);
    backdrop-filter: blur(0.7rem);
  }

  .review-label {
    min-inline-size: min(21rem, calc(100vw - 12rem));
    padding: 0.75rem 1rem 0.85rem;
    border-radius: 0.9rem;
  }

  .review-label p,
  .review-label h1 {
    margin: 0;
  }

  .review-label p {
    color: #a8c86a;
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

  .review-label span,
  .walk-note span,
  .ensemble-note span,
  .loading span {
    color: #d0d8bd;
    font-size: 0.86rem;
  }

  .walk-note,
  .ensemble-note {
    position: absolute;
    z-index: 55;
    display: grid;
    gap: 0.12rem;
    padding: 0.68rem 0.88rem;
    border-radius: 0.8rem;
    pointer-events: none;
  }

  .walk-note {
    inset-inline-start: 50%;
    inset-block-end: clamp(0.8rem, 1.5vw, 1.5rem);
    inline-size: min(29rem, calc(100vw - 2rem));
    transform: translateX(-50%);
    text-align: center;
  }

  .ensemble-note {
    inset-inline-end: clamp(0.8rem, 1.5vw, 1.5rem);
    inset-block-end: clamp(0.8rem, 1.5vw, 1.5rem);
    text-align: end;
  }

  .walk-note strong,
  .ensemble-note strong,
  .loading strong {
    color: #eef6dc;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
  }

  .loading {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 70;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.85rem 1rem;
    border-radius: 0.9rem;
    transform: translate(-50%, -50%);
  }

  .loading div {
    display: grid;
    gap: 0.08rem;
  }

  .loading-mark {
    inline-size: 0.85rem;
    block-size: 0.85rem;
    border: 2px solid rgba(203, 226, 157, 0.25);
    border-block-start-color: #a8c86a;
    border-radius: 50%;
    animation: turn 0.8s linear infinite;
  }

  @keyframes turn {
    to {
      transform: rotate(1turn);
    }
  }

  @media (max-width: 64rem) {
    .review-label {
      min-inline-size: 0;
      max-inline-size: calc(100vw - 8.5rem);
    }

    .ensemble-note {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-mark {
      animation: none;
    }
  }
</style>
