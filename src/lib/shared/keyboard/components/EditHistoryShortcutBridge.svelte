<script lang="ts">
  interface Props {
    onUndo?: () => void | Promise<void>;
    onRedo?: () => void | Promise<void>;
    canUndo?: boolean;
    canRedo?: boolean;
    undoLabel?: string | null;
    redoLabel?: string | null;
  }

  let {
    onUndo,
    onRedo,
    canUndo = true,
    canRedo = true,
    undoLabel,
    redoLabel,
  }: Props = $props();
</script>

{#if onUndo}
  <button
    type="button"
    class="shortcut-target"
    data-undo-shortcut
    data-undo-shortcut-label={undoLabel || undefined}
    disabled={!canUndo}
    tabindex="-1"
    aria-label={undoLabel ? `Undo: ${undoLabel}` : "Undo"}
    onclick={onUndo}>Undo</button
  >
{/if}

{#if onRedo}
  <button
    type="button"
    class="shortcut-target"
    data-redo-shortcut
    data-redo-shortcut-label={redoLabel || undefined}
    disabled={!canRedo}
    tabindex="-1"
    aria-label={redoLabel ? `Redo: ${redoLabel}` : "Redo"}
    onclick={onRedo}>Redo</button
  >
{/if}

<style>
  .shortcut-target {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    border: 0;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
