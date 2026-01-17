<!--
  VideoPreview.svelte

  Video container with loading, recording indicator, and error overlays.
-->
<script lang="ts">
  interface Props {
    videoContainer: HTMLDivElement | undefined;
    isInitialized: boolean;
    isRecording: boolean;
    lastError: string | null;
  }

  let {
    videoContainer = $bindable(),
    isInitialized,
    isRecording,
    lastError,
  }: Props = $props();
</script>

<div class="video-wrapper">
  <div class="video-container" bind:this={videoContainer}>
    {#if !isInitialized}
      <div class="loading-overlay">
        <div class="spinner"></div>
        <p>Initializing camera...</p>
      </div>
    {/if}

    {#if isRecording}
      <div class="recording-indicator">
        <span class="rec-dot"></span>
        <span>REC</span>
      </div>
    {/if}

    {#if lastError}
      <div class="error-overlay">
        <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
        <p>{lastError}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .video-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .video-container {
    width: 100%;
    height: 100%;
    max-width: min(100%, 100vh - 200px);
    max-height: min(100%, 100vh - 200px);
    aspect-ratio: 1 / 1;
    position: relative;
    background: #000;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .loading-overlay,
  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    gap: 1rem;
  }

  .error-overlay {
    color: #ff6b6b;
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-text);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .recording-indicator {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: rgba(239, 68, 68, 0.9);
    border-radius: 8px;
    font-weight: bold;
    font-size: 0.9rem;
    animation: pulse 1s ease-in-out infinite;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  .rec-dot {
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  @media (min-width: 1024px) {
    .video-wrapper {
      position: relative;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
    .recording-indicator {
      animation: none;
    }
  }
</style>
