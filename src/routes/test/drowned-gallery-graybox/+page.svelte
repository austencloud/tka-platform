<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { AgXToneMapping, PCFSoftShadowMap } from "three";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import DrownedGalleryWalkScene from "./DrownedGalleryWalkScene.svelte";
  import { drownedGalleryLocationLabel } from "./drowned-gallery-graybox-colliders";

  let assetReady = $state(false);
  let resetToken = $state(0);
  let position = $state({ x: 0.25, y: 0.95, z: 33 });

  const locationLabel = $derived(drownedGalleryLocationLabel(position));
</script>

<svelte:head>
  <title>Walk the Drowned Gallery graybox</title>
  <meta
    name="description"
    content="First-person spatial review of the Drowned Gallery Blender graybox."
  />
</svelte:head>

<main
  class="walk-page"
  data-player-x={position.x.toFixed(3)}
  data-player-y={position.y.toFixed(3)}
  data-player-z={position.z.toFixed(3)}
>
  <div class="viewport" aria-label="The Drowned Gallery first-person graybox">
    <Canvas dpr={1} shadows={PCFSoftShadowMap} toneMapping={AgXToneMapping}>
      <DrownedGalleryWalkScene
        {resetToken}
        onAssetReady={() => (assetReady = true)}
        onPositionChange={(nextPosition) => (position = nextPosition)}
      />
    </Canvas>
  </div>

  <header class="review-hud">
    <div class="review-label">
      <p>Vulcan Cave spatial review</p>
      <h1>The Drowned Gallery</h1>
      <span>{locationLabel}</span>
    </div>
    <ActionButton
      label="Reset to approach"
      icon="fa-arrow-rotate-left"
      color="fuse"
      onclick={() => (resetToken += 1)}
    />
  </header>

  {#if !assetReady}
    <div class="loading" role="status" aria-live="polite">
      <span class="loading-mark" aria-hidden="true"></span>
      <div>
        <strong>Flooding the gallery</strong>
        <span>Loading the Blender graybox</span>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #020407;
  }

  .walk-page {
    --theme-accent: #38bdf8;
    --theme-card-bg: rgba(5, 14, 20, 0.82);
    --theme-card-hover-bg: rgba(9, 28, 40, 0.92);
    --theme-stroke: rgba(186, 230, 253, 0.2);
    --theme-stroke-strong: rgba(56, 189, 248, 0.58);
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

  .review-label,
  .loading {
    border: 1px solid rgba(186, 230, 253, 0.18);
    background: rgba(3, 10, 15, 0.76);
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
    color: #38bdf8;
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
  }

  .loading {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 70;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    min-inline-size: 17rem;
    padding: 1rem 1.2rem;
    border-radius: 1rem;
    transform: translate(-50%, -50%);
  }

  .loading div {
    display: grid;
    gap: 0.15rem;
  }

  .loading strong {
    color: #ecfeff;
    font-size: 0.96rem;
  }

  .loading span:not(.loading-mark) {
    color: #9fb8c2;
    font-size: 0.82rem;
  }

  .loading-mark {
    inline-size: 1.1rem;
    block-size: 1.1rem;
    border: 2px solid rgba(56, 189, 248, 0.25);
    border-block-start-color: #38bdf8;
    border-radius: 50%;
    animation: spin 720ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }

  @media (min-width: 1680px) {
    .review-label {
      padding: 0.95rem 1.2rem 1rem;
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
      min-inline-size: 31rem;
      padding: 1.35rem 1.65rem 1.5rem;
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

    .review-label {
      min-inline-size: 0;
      inline-size: 100%;
    }

    .review-hud :global(button) {
      align-self: flex-end;
    }
  }

  @media (max-height: 31rem) {
    .review-label p,
    .review-label span {
      display: none;
    }

    .review-label {
      min-inline-size: 0;
      padding: 0.55rem 0.75rem;
    }

    .review-label h1 {
      margin: 0;
      font-size: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-mark {
      animation-duration: 1.6s;
    }
  }
</style>
