<!--
  ArtActionFooter.svelte — the pinned footer both Art sidebars end with.

  Share sits above Export and carries the fill, because the render is far more
  often something you want to post than something you want in your Downloads
  folder. Austen (2026-08-11): "if I'm in the tunnel there should be a big fat
  share button specifically for sharing that tunnel ... share could be a 1st
  class action which is always visible to you anytime you're looking at
  anything remotely interesting."

  Stacked rather than side by side: the sidebar floors at 300px, and two
  labelled buttons in one row truncate "Export MP4" there. Vertical is the axis
  with room — the scroll region above absorbs it.

  Shared because Mandala and Tunnel had already grown identical copies of the
  export button, and adding Share to each would have made four.
-->
<script lang="ts">
  interface Props {
    /** Opens the post-share sheet with this art as the artifact. */
    onShare: () => void;
    /** Renders the file and saves it. */
    onExport: () => void;
    /** "Export MP4" / "Export Video" — the two products name their file. */
    exportLabel: string;
    /** A render is already in flight; both actions would queue behind it. */
    busy?: boolean;
  }

  let { onShare, onExport, exportLabel, busy = false }: Props = $props();
</script>

<div class="panel-footer">
  <button
    type="button"
    class="share-btn"
    onclick={onShare}
    disabled={busy}
    data-testid="art-share-button"
  >
    <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
    <span>Share</span>
  </button>
  <button type="button" class="export-btn" onclick={onExport} disabled={busy}>
    {#if busy}
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    {:else}
      <i class="fas fa-film" aria-hidden="true"></i>
    {/if}
    <span>{exportLabel}</span>
  </button>
</div>

<style>
  .panel-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px 16px;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .share-btn,
  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    border-radius: 12px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  .share-btn {
    background: var(--theme-accent);
    border: 1.5px solid var(--theme-accent);
    color: white;
  }

  /* Export keeps its shape and its weight, and gives up only the fill. It is
     still a real button (.claude/rules/clickables-look-like-buttons.md) — the
     hierarchy is which one is filled, not which one looks pressable. */
  .export-btn {
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    color: var(--theme-text, rgba(255, 255, 255, 0.92));
  }

  .share-btn:disabled,
  .export-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (hover: hover) and (pointer: fine) {
    .share-btn:hover:not(:disabled) {
      filter: brightness(1.1);
    }
    .export-btn:hover:not(:disabled) {
      background: var(--theme-surface-hover, rgba(255, 255, 255, 0.06));
    }
  }

  .share-btn:focus-visible,
  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .share-btn,
    .export-btn {
      transition: none;
    }
  }
</style>
