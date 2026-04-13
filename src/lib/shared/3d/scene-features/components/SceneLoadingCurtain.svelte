<script lang="ts">
  /**
   * SceneLoadingCurtain
   *
   * Dark overlay with drifting firefly dots and a progress bar.
   * Covers the 3D canvas until all initially-enabled async scene
   * features have reported their assets loaded. Only shows on first
   * load — toggling features mid-session does NOT bring it back.
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";
  import { fade } from "svelte/transition";

  const sceneFeatures = getSceneFeatureContext();

  const progress = $derived(sceneFeatures.readyProgress);

  // Track whether the initial load has completed. Once it has,
  // the curtain never comes back — even if the user toggles on
  // a new async feature that hasn't loaded yet.
  let initialLoadComplete = $state(false);

  $effect(() => {
    if (sceneFeatures.allEnabledReady && !initialLoadComplete) {
      initialLoadComplete = true;
    }
  });

  const showCurtain = $derived(!initialLoadComplete);

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

    <div class="progress-area">
      <p class="status-text">Setting the stage...</p>
      <div class="progress-track">
        <div class="progress-fill" style="width: {progress * 100}%"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .curtain {
    position: absolute;
    inset: 0;
    z-index: 20;
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
    0%, 100% {
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
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .status-text {
    color: rgba(255, 200, 120, 0.6);
    font-size: var(--font-size-min, 14px);
    margin: 0;
    letter-spacing: 0.04em;
  }

  .progress-track {
    width: 180px;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: rgba(255, 180, 70, 0.7);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
</style>
