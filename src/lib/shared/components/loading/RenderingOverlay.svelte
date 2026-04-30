<!--
  RenderingOverlay - Shared loading overlay for thumbnail/card re-renders.

  Shows a semi-transparent dark overlay with a spinner, status label,
  and optional progress bar. Positioned absolutely within its parent
  (parent must have position: relative).

  Used by: PropAwareThumbnail, PrintPrepView, and any future component
  that renders images asynchronously and needs in-place loading feedback.
-->
<script lang="ts">
  import ProgressRing from "./ProgressRing.svelte";

  interface Props {
    /** Text label below the spinner (e.g., "Rendering", "3/8", "Queued") */
    label?: string;
    /** Progress percentage 0-100, or -1 for indeterminate spinner */
    progress?: number;
    /** Show a progress bar at the bottom of the overlay */
    showProgressBar?: boolean;
  }

  const {
    label = "Rendering",
    progress = -1,
    showProgressBar = false,
  }: Props = $props();
</script>

<div class="rendering-overlay" aria-label={label}>
  <div class="overlay-content">
    <ProgressRing percent={-1} size={24} strokeWidth={2} />
    <span class="overlay-status">{label}</span>
  </div>
  {#if showProgressBar && progress >= 0}
    <div
      class="overlay-progress-bar"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div class="overlay-progress-fill" style:width="{progress}%"></div>
    </div>
  {/if}
</div>

<style>
  .rendering-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10;
    border-radius: inherit;
    pointer-events: none;
  }

  .overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .overlay-status {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .overlay-progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .overlay-progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 0 2px 2px 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay-progress-fill {
      transition: none;
    }
  }
</style>
