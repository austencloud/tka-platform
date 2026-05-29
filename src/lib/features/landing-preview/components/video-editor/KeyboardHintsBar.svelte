<script lang="ts">
  /**
   * KeyboardHintsBar
   *
   * Bottom bar showing keyboard shortcut hints for the current mode.
   */
  import type { VideoEditorMode } from "../../state/video-editor-controller.svelte";

  interface Props {
    mode: VideoEditorMode;
    categoryCount: number;
    performerKeys: string;
    hasSelectedSequence: boolean;
  }

  let { mode, categoryCount, performerKeys, hasSelectedSequence }: Props = $props();

  const performerHint = $derived(
    performerKeys.slice(0, 6).toUpperCase().split("").join("-")
  );
</script>

<div class="keyboard-hints">
  {#if mode === "curate" || mode === "browse"}
    <div class="hint-group">
      <kbd>1</kbd>-<kbd>{categoryCount}</kbd>
      <span>Category</span>
    </div>
    <div class="hint-group">
      <kbd>{performerHint}</kbd>
      <span>Performer</span>
    </div>
  {/if}
  {#if mode === "link"}
    <div class="hint-group">
      <kbd>1</kbd>-<kbd>9</kbd>
      <span>Select sequence</span>
    </div>
    {#if hasSelectedSequence}
      <div class="hint-group">
        <kbd>Enter</kbd>
        <span>Confirm link</span>
      </div>
    {/if}
  {/if}
  {#if mode === "curate" || mode === "link"}
    <div class="hint-group">
      <kbd>&larr;</kbd><kbd>&rarr;</kbd>
      <span>Navigate</span>
    </div>
    <div class="hint-group">
      <kbd>X</kbd>
      <span>Skip</span>
    </div>
  {/if}
  {#if mode === "curate"}
    <div class="hint-group">
      <kbd>E</kbd>
      <span>Exclude</span>
    </div>
  {/if}
  <div class="hint-group">
    <kbd>Esc</kbd>
    <span>Close</span>
  </div>
</div>

<style>
  .keyboard-hints {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    flex-wrap: wrap;
  }

  .hint-group {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .hint-group span {
    margin-left: 2px;
  }

  @media (max-width: 600px) {
    .keyboard-hints {
      gap: 12px;
      padding: 10px 12px;
    }

    .hint-group {
      font-size: 11px;
    }

    /* Hide less important hints on mobile */
    .hint-group:nth-child(n+5) {
      display: none;
    }
  }
</style>
