<!--
ProgressOverlay.svelte

Progress indicators for AnimatorCanvas.
Shows pre-render progress and perfect playback badge.
-->
<script lang="ts">
  import type { PreRenderProgress } from "$lib/features/compose/services/implementations/SequenceFramePreRenderer";

  let {
    isPreRendering = false,
    preRenderProgress = null,
    preRenderedFramesReady = false,
  }: {
    isPreRendering?: boolean;
    preRenderProgress?: PreRenderProgress | null;
    preRenderedFramesReady?: boolean;
  } = $props();
</script>

<!-- Pre-render progress indicator -->
{#if isPreRendering && preRenderProgress}
  <div
    class="pre-render-badge"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div class="badge-content">
      <div class="spinner-small" aria-hidden="true"></div>
      <span>Optimizing... {Math.round(preRenderProgress.percent)}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        style="width: {preRenderProgress.percent}%"
      ></div>
    </div>
  </div>
{/if}

<!-- Perfect playback indicator (brief flash when ready) -->
{#if preRenderedFramesReady}
  <div class="perfect-mode-badge">✨ Perfect Playback</div>
{/if}

<style>
  .pre-render-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: var(--font-size-compact); /* Supplementary status text */
    font-weight: 500;
    z-index: 10;
    box-shadow: 0 2px 8px var(--theme-shadow);
    min-width: 140px;
  }

  .badge-content {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .spinner-small {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4ade80, var(--semantic-success));
    transition: width var(--duration-emphasis) ease;
  }

  .perfect-mode-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: linear-gradient(135deg, var(--semantic-success), #16a34a);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: var(--font-size-compact); /* Supplementary badge text */
    font-weight: 600;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    animation: fadeInOut 3s ease forwards;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: translateY(-10px);
    }
    10% {
      opacity: 1;
      transform: translateY(0);
    }
    90% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-10px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner-small {
      animation: none;
      border-top-color: white;
      border-right-color: white;
    }

    .perfect-mode-badge {
      animation: none;
    }
  }
</style>
