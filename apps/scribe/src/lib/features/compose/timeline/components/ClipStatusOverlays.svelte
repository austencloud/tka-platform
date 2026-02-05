<script lang="ts">
  /**
   * ClipStatusOverlays - Visual overlays for muted/locked clip states
   */

  interface Props {
    muted: boolean;
    locked: boolean;
  }

  let { muted, locked }: Props = $props();
</script>

{#if muted}
  <div class="status-overlay muted">
    <i class="fa-solid fa-volume-xmark" aria-hidden="true"></i>
  </div>
{/if}

{#if locked}
  <div class="status-overlay locked">
    <i class="fa-solid fa-lock" aria-hidden="true"></i>
  </div>
{/if}

<style>
  .status-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 5;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .status-overlay.muted {
    background: color-mix(in srgb, var(--theme-panel-bg) 60%, transparent);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-base);
  }

  .status-overlay.locked {
    background: color-mix(in srgb, var(--theme-panel-bg) 30%, transparent);
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }
</style>
