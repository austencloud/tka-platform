<!--
  MobileSegmentControl.svelte

  Segmented control for switching between Pictograph, Animation, and Image
  panels on mobile devices. Hidden on desktop via container query.
-->
<script lang="ts">
  import type { VisibilityMode } from "./visibility-types";

  interface Props {
    currentMode: VisibilityMode;
    onModeChange: (mode: VisibilityMode) => void;
  }

  let { currentMode, onModeChange }: Props = $props();
</script>

<div class="mobile-segment-control">
  <button
    class="segment-btn"
    class:active={currentMode === "pictograph"}
    onclick={() => onModeChange("pictograph")}
  >
    <i class="fas fa-image" aria-hidden="true"></i>
    <span>Pictograph</span>
  </button>
  <button
    class="segment-btn"
    class:active={currentMode === "animation"}
    onclick={() => onModeChange("animation")}
  >
    <i class="fas fa-film" aria-hidden="true"></i>
    <span>Animation</span>
  </button>
  <button
    class="segment-btn"
    class:active={currentMode === "image"}
    onclick={() => onModeChange("image")}
  >
    <i class="fas fa-download" aria-hidden="true"></i>
    <span>Choreo Card</span>
  </button>
</div>

<style>
  .mobile-segment-control {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
    padding: 6px;
    background: var(--theme-card-bg);
    border-radius: 16px;
    border: 1px solid var(--theme-stroke);
    width: 100%;
    margin-bottom: 12px;
  }

  .segment-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 12px 14px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .segment-btn i {
    font-size: var(--font-size-sm, 14px);
    transition: all 150ms ease;
  }

  /* Narrow widths: stack icon above label so longer labels stay on one line
     and all three buttons keep equal height. */
  @media (max-width: 480px) {
    .segment-btn {
      flex-direction: column;
      gap: 4px;
      padding: 8px 6px;
      font-size: var(--font-size-compact, 12px);
    }
  }

  .segment-btn:hover {
    background: color-mix(in srgb, var(--theme-card-hover-bg) 50%, transparent);
    border-color: var(--theme-stroke);
    color: var(--theme-text);
  }

  .segment-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: white;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      0 4px 16px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .segment-btn.active i {
    filter: drop-shadow(0 0 6px var(--theme-accent));
  }

  .segment-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .segment-btn, .segment-btn i {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .segment-btn {
      border-width: 2px;
    }
    .segment-btn.active {
      border-color: var(--theme-accent);
    }
    .segment-btn:focus-visible {
      outline-width: 3px;
    }
  }
</style>
