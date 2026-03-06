<!--
  SyncSkeleton.svelte

  Skeleton loading states for sync room components.
  Provides visual feedback while sequence data or connections are loading.

  Variants:
  - sequence: Loading sequence data (pictograph placeholder + beat grid)
  - room: Initial room loading (full room skeleton)
  - controls: Playback controls skeleton

  Accessibility:
  - aria-hidden since this is purely decorative
  - Respects prefers-reduced-motion
-->
<script lang="ts">
  import ProgressRing from '$lib/shared/components/loading/ProgressRing.svelte';

  interface Props {
    /** Skeleton variant */
    variant?: 'sequence' | 'room' | 'controls';
    /** Number of beat cells for grid skeleton */
    beatCount?: number;
    /** Show progress text */
    showProgress?: boolean;
    /** Progress text to display */
    progressText?: string;
  }

  let {
    variant = 'sequence',
    beatCount = 8,
    showProgress = true,
    progressText = 'Loading sequence...',
  }: Props = $props();
</script>

<div
  class="sync-skeleton"
  class:variant-sequence={variant === 'sequence'}
  class:variant-room={variant === 'room'}
  class:variant-controls={variant === 'controls'}
  aria-hidden="true"
>
  {#if variant === 'sequence'}
    <!-- Sequence loading skeleton -->
    <div class="skeleton-content">
      <!-- Main pictograph area -->
      <div class="skeleton-pictograph">
        <div class="skeleton-circle-large"></div>
        <div class="skeleton-grid-overlay">
          <span class="skeleton-line-h"></span>
          <span class="skeleton-line-v"></span>
        </div>
      </div>

      <!-- Beat grid preview -->
      <div class="skeleton-beat-grid">
        {#each Array(Math.min(beatCount, 12)) as _, i}
          <div
            class="skeleton-beat"
            style="--stagger: {i}"
          ></div>
        {/each}
      </div>

      {#if showProgress}
        <div class="skeleton-progress">
          <ProgressRing percent={-1} size={24} strokeWidth={2} />
          <span class="skeleton-text">{progressText}</span>
        </div>
      {/if}
    </div>

  {:else if variant === 'room'}
    <!-- Full room loading skeleton -->
    <div class="skeleton-room">
      <!-- Header skeleton -->
      <div class="skeleton-header">
        <div class="skeleton-status">
          <div class="skeleton-dot"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
        <div class="skeleton-tabs">
          <div class="skeleton-tab"></div>
          <div class="skeleton-tab"></div>
          <div class="skeleton-tab"></div>
        </div>
        <div class="skeleton-btn"></div>
      </div>

      <!-- Main content skeleton -->
      <div class="skeleton-main">
        <div class="skeleton-panel">
          <div class="skeleton-pictograph-large">
            <div class="skeleton-circle-large"></div>
          </div>
        </div>
      </div>

      <!-- Footer skeleton -->
      <div class="skeleton-footer">
        <div class="skeleton-controls">
          <div class="skeleton-btn-small"></div>
          <div class="skeleton-btn-play"></div>
          <div class="skeleton-btn-small"></div>
        </div>
        <div class="skeleton-line skeleton-line--medium"></div>
        <div class="skeleton-speed-btns">
          <div class="skeleton-btn-tiny"></div>
          <div class="skeleton-btn-tiny"></div>
          <div class="skeleton-btn-tiny"></div>
        </div>
      </div>
    </div>

    {#if showProgress}
      <div class="skeleton-progress centered">
        <ProgressRing percent={-1} size={24} strokeWidth={2} />
        <span class="skeleton-text">{progressText}</span>
      </div>
    {/if}

  {:else if variant === 'controls'}
    <!-- Controls only skeleton -->
    <div class="skeleton-controls-row">
      <div class="skeleton-btn-small"></div>
      <div class="skeleton-btn-play"></div>
      <div class="skeleton-btn-small"></div>
      <div class="skeleton-line skeleton-line--short"></div>
      <div class="skeleton-speed-btns">
        <div class="skeleton-btn-tiny"></div>
        <div class="skeleton-btn-tiny"></div>
        <div class="skeleton-btn-tiny"></div>
        <div class="skeleton-btn-tiny"></div>
      </div>
    </div>
  {/if}
</div>

<style>
  .sync-skeleton {
    width: 100%;
    height: 100%;
  }

  /* Shimmer animation */
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Base shimmer styles */
  .skeleton-line,
  .skeleton-dot,
  .skeleton-tab,
  .skeleton-btn,
  .skeleton-btn-small,
  .skeleton-btn-play,
  .skeleton-btn-tiny,
  .skeleton-beat,
  .skeleton-circle-large {
    background: linear-gradient(
      90deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 25%,
      var(--theme-stroke, rgba(255, 255, 255, 0.1)) 50%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
    border-radius: 4px;
  }

  /* Sequence variant */
  .skeleton-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 24px;
    height: 100%;
    justify-content: center;
  }

  .skeleton-pictograph {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-circle-large {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    opacity: 0.3;
  }

  .skeleton-grid-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-line-h,
  .skeleton-line-v {
    position: absolute;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    animation: none;
  }

  .skeleton-line-h {
    width: 70%;
    height: 2px;
  }

  .skeleton-line-v {
    width: 2px;
    height: 70%;
  }

  .skeleton-beat-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 300px;
  }

  .skeleton-beat {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    animation-delay: calc(var(--stagger) * 100ms);
  }

  .skeleton-progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .skeleton-progress.centered {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .skeleton-text {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Room variant */
  .skeleton-room {
    display: flex;
    flex-direction: column;
    height: 100%;
    opacity: 0.6;
  }

  .skeleton-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .skeleton-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .skeleton-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .skeleton-line--short {
    width: 60px;
    height: 14px;
  }

  .skeleton-line--medium {
    width: 80px;
    height: 14px;
  }

  .skeleton-tabs {
    display: flex;
    gap: 4px;
  }

  .skeleton-tab {
    width: 40px;
    height: 40px;
    border-radius: 8px;
  }

  .skeleton-btn {
    width: 80px;
    height: 40px;
    border-radius: 8px;
  }

  .skeleton-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .skeleton-panel {
    width: 100%;
    max-width: 400px;
    aspect-ratio: 1;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-pictograph-large {
    width: 60%;
    aspect-ratio: 1;
  }

  .skeleton-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .skeleton-controls {
    display: flex;
    gap: 4px;
  }

  .skeleton-btn-small {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
  }

  .skeleton-btn-play {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 25%,
      var(--theme-stroke, rgba(255, 255, 255, 0.1)) 50%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 75%
    );
    background-size: 200% 100%;
  }

  .skeleton-speed-btns {
    display: flex;
    gap: 4px;
  }

  .skeleton-btn-tiny {
    width: 40px;
    height: 40px;
    border-radius: 8px;
  }

  /* Controls variant */
  .skeleton-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-line,
    .skeleton-dot,
    .skeleton-tab,
    .skeleton-btn,
    .skeleton-btn-small,
    .skeleton-btn-play,
    .skeleton-btn-tiny,
    .skeleton-beat,
    .skeleton-circle-large {
      animation: none;
      background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

  }

  /* High contrast */
  @media (prefers-contrast: high) {
    .skeleton-line,
    .skeleton-dot,
    .skeleton-tab,
    .skeleton-btn,
    .skeleton-btn-small,
    .skeleton-btn-play,
    .skeleton-btn-tiny,
    .skeleton-beat,
    .skeleton-circle-large {
      background: var(--theme-stroke, rgba(255, 255, 255, 0.2));
      animation: none;
    }
  }
</style>
