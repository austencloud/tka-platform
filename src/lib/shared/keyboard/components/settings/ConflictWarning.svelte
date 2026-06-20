<!--
  ConflictWarning.svelte

  Displays a warning when a key combo conflicts with an existing shortcut.
  Shows severity level and conflicting shortcut information.
-->
<script lang="ts">
  import type { ShortcutConflict } from "../../domain/types/keyboard-types";

  let {
    conflict,
    onReplace = undefined,
    onSwap = undefined,
  }: {
    conflict: ShortcutConflict;
    onReplace?: () => void;
    onSwap?: () => void;
  } = $props();

  const isError = $derived(conflict.severity === "error");
</script>

<div class="conflict-warning" class:error={isError} class:warning={!isError}>
  <div class="conflict-icon">
    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
  </div>
  <div class="conflict-info">
    <span class="conflict-title">
      {isError ? "Shortcut Conflict" : "Potential Conflict"}
    </span>
    <span class="conflict-detail">
      Already assigned to "{conflict.existingShortcutLabel}"
      {#if !isError}
        <span class="context-note">(in different context)</span>
      {/if}
    </span>
  </div>
  {#if onReplace || onSwap}
    <div class="conflict-actions">
      {#if onSwap}
        <button class="conflict-btn swap" onclick={onSwap} type="button">
          Swap
        </button>
      {/if}
      {#if onReplace && isError}
        <button class="conflict-btn replace" onclick={onReplace} type="button">
          Replace
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .conflict-warning {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    margin-top: 8px;
  }

  .conflict-warning.error {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 10%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 30%,
        transparent
      );
  }

  .conflict-warning.warning {
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 30%, transparent);
  }

  .conflict-icon {
    flex-shrink: 0;
    font-size: var(--font-size-base);
  }

  .error .conflict-icon {
    color: var(--semantic-error, var(--semantic-error));
  }

  .warning .conflict-icon {
    color: var(--semantic-warning);
  }

  .conflict-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .conflict-title {
    font-weight: 600;
    font-size: var(--font-size-compact);
  }

  .error .conflict-title {
    color: var(--semantic-error, var(--semantic-error));
  }

  .warning .conflict-title {
    color: var(--semantic-warning);
  }

  .conflict-detail {
    font-size: var(--font-size-compact);
    color: color-mix(in srgb, var(--theme-text, white) 70%, transparent);
  }

  .context-note {
    color: var(--theme-text-dim);
    font-style: italic;
  }

  .conflict-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .conflict-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .conflict-btn.replace {
    background: var(--semantic-error, var(--semantic-error));
    border: none;
    color: var(--theme-text, white);
  }

  .conflict-btn.replace:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 85%,
      var(--theme-shadow, #000)
    );
  }

  .conflict-btn.swap {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  .conflict-btn.swap:hover {
    background: var(--theme-card-hover-bg);
  }
</style>
