<!-- LayoutToggles - Toggle buttons for timeline panel layout options -->
<script lang="ts">
  interface Props {
    showMediaBrowser: boolean;
    showPreview: boolean;
    onToggleMediaBrowser: () => void;
    onTogglePreview: () => void;
  }

  const {
    showMediaBrowser,
    showPreview,
    onToggleMediaBrowser,
    onTogglePreview,
  }: Props = $props();
</script>

<div class="layout-toggles">
  <button
    class="toggle-btn"
    class:active={showMediaBrowser}
    onclick={onToggleMediaBrowser}
    title={showMediaBrowser ? "Hide media browser" : "Show media browser"}
    aria-label={showMediaBrowser ? "Hide media browser" : "Show media browser"}
  >
    <i class="fas fa-photo-film" aria-hidden="true"></i>
  </button>
  <button
    class="toggle-btn"
    class:active={showPreview}
    onclick={onTogglePreview}
    title={showPreview ? "Hide monitors" : "Show monitors"}
    aria-label={showPreview ? "Hide monitors" : "Show monitors"}
  >
    <i class="fa-solid fa-tv" aria-hidden="true"></i>
  </button>
</div>

<style>
  .layout-toggles {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .toggle-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-elevated-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
    transform: translateY(-1px);
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .toggle-btn {
      transition: none;
    }

    .toggle-btn:hover {
      transform: none;
    }
  }
</style>
