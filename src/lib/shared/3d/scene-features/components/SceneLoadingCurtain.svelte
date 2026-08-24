<script lang="ts">
  /**
   * SceneLoadingCurtain
   *
   * Dark overlay with drifting firefly dots and a progress bar.
   * Covers the 3D canvas until all initially-enabled async scene
   * features have reported their assets loaded. Only shows on first
   * load - toggling features mid-session does NOT bring it back.
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";
  import { fade } from "svelte/transition";

  interface Props {
    additionalRevealReady?: boolean;
    additionalRevealProgress?: number | null;
    additionalRevealLabel?: string;
  }

  let {
    additionalRevealReady = true,
    additionalRevealProgress = null,
    additionalRevealLabel = "Finishing the scene",
  }: Props = $props();

  const sceneFeatures = getSceneFeatureContext();

  const sceneProgress = $derived(sceneFeatures.initialRevealSettledProgress);
  const progress = $derived(
    additionalRevealProgress === null
      ? sceneProgress
      : (sceneProgress + Math.max(0, Math.min(additionalRevealProgress, 1))) / 2
  );
  const revealSettled = $derived(
    sceneFeatures.allInitialRevealFeaturesSettled && additionalRevealReady
  );
  const statusText = $derived(
    sceneFeatures.allInitialRevealFeaturesSettled
      ? additionalRevealLabel
      : "Setting the stage"
  );

  // Track whether the initial load has completed. Once it has,
  // the curtain never comes back - even if the user toggles on
  // a new async feature that hasn't loaded yet.
  let initialLoadComplete = $state(false);

  $effect(() => {
    if (revealSettled && !initialLoadComplete) {
      initialLoadComplete = true;
    }
  });

  const showCurtain = $derived(!initialLoadComplete);

  $effect(() => {
    if (!showCurtain) return;
    const enabled = sceneFeatures.features.filter(
      (f) =>
        f.requiresAsyncLoad &&
        sceneFeatures.isEnabled(f.key) &&
        sceneFeatures.blocksInitialReveal(f.key)
    );
    const pending = enabled.filter(
      (feature) =>
        !sceneFeatures.isReady(feature.key) &&
        !sceneFeatures.getError(feature.key)
    );
    console.debug(
      `[Curtain] progress=${(progress * 100).toFixed(0)}% | enabled=[${enabled.map((f) => f.key)}] | pending=[${pending.map((f) => f.key)}]`
    );
  });

  const fireflies = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: 10 + ((i * 37) % 80),
    top: 10 + ((i * 53) % 80),
    delay: (i * 0.4) % 3.2,
    duration: 2.5 + (i % 3) * 0.8,
  }));
</script>

{#if showCurtain}
  <div class="curtain" transition:fade={{ duration: 400 }}>
    {#each fireflies as fly (fly.id)}
      <div
        class="firefly"
        style="
          left: {fly.left}%;
          top: {fly.top}%;
          animation-delay: {fly.delay}s;
          animation-duration: {fly.duration}s;
        "
      ></div>
    {/each}

    <div class="progress-area" role="status" aria-live="polite">
      <div class="status-row">
        <span class="spinner" aria-hidden="true"></span>
        <p class="status-text">{statusText}</p>
      </div>
      <div class="progress-track" aria-label="Scene loading progress">
        <div class="progress-fill" style="width: {progress * 100}%"></div>
      </div>
      <p class="percent-text">{Math.round(progress * 100)}%</p>
    </div>
  </div>
{/if}

<style>
  .curtain {
    position: absolute;
    inset: 0;
    /* Above the transport (.timeline-anchor, z-index 20) and beat strip (10) so
       the scrubber doesn't paint over the loading screen and read as "loaded". */
    z-index: 30;
    background: #0a0e14;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .firefly {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d4e157;
    box-shadow: 0 0 8px 2px rgba(212, 225, 87, 0.4);
    opacity: 0;
    animation: drift ease-in-out infinite;
  }

  @keyframes drift {
    0%,
    100% {
      opacity: 0;
      transform: translate(0, 0);
    }
    25% {
      opacity: 0.7;
      transform: translate(12px, -8px);
    }
    50% {
      opacity: 0.3;
      transform: translate(-6px, -16px);
    }
    75% {
      opacity: 0.8;
      transform: translate(8px, -4px);
    }
  }

  .progress-area {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    pointer-events: none;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255, 200, 120, 0.18);
    border-top-color: rgba(255, 200, 120, 0.95);
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .status-text {
    color: rgba(255, 220, 170, 0.95);
    font-size: var(--font-size-base, 15px);
    font-weight: 500;
    margin: 0;
    letter-spacing: 0.04em;
    animation: pulse 2s ease-in-out infinite;
  }

  /* Animated ellipsis - three dots that cascade in */
  .status-text::after {
    content: "";
    display: inline-block;
    width: 1.2em;
    text-align: left;
    animation: ellipsis 1.4s steps(4, end) infinite;
  }

  @keyframes ellipsis {
    0% {
      content: "";
    }
    25% {
      content: ".";
    }
    50% {
      content: "..";
    }
    75% {
      content: "...";
    }
    100% {
      content: "";
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.85;
    }
    50% {
      opacity: 1;
    }
  }

  .progress-track {
    width: 220px;
    height: 5px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 180, 70, 0.85),
      rgba(255, 210, 130, 0.95)
    );
    border-radius: 3px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(255, 180, 70, 0.4);
  }

  .percent-text {
    color: rgba(255, 220, 170, 0.75);
    font-size: var(--font-size-min, 13px);
    font-variant-numeric: tabular-nums;
    margin: 0;
    letter-spacing: 0.05em;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner,
    .status-text,
    .status-text::after {
      animation: none;
    }
    .status-text::after {
      content: "...";
    }
  }
</style>
