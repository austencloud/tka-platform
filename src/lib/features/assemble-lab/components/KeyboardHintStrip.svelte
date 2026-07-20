<!--
  KeyboardHintStrip.svelte - Compact numpad control key reference bar.
  Visible only in keyboard mode. Shows current turn count + rotation direction.
-->
<script lang="ts">
  import type { AssembleState } from "../state/assemble-state.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let { builderState }: { builderState: AssembleState } = $props();

  const rotLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? "CW"
      : "CCW"
  );

  const turnLabel = $derived(
    builderState.turnCount === -0.5 ? "fl" : String(builderState.turnCount)
  );
</script>

<div class="hint-strip" aria-label="Keyboard controls reference">
  <span class="state-badge" aria-live="polite">
    <span class="badge-value">{turnLabel}</span>
    <span class="badge-label">{rotLabel}</span>
  </span>
  <span class="hint-divider" aria-hidden="true"></span>
  <span class="hint"><kbd>+</kbd><kbd>−</kbd> turns</span>
  <span class="hint"><kbd>*</kbd> flip</span>
  <span class="hint"><kbd>/</kbd> ori</span>
  <span class="hint"><kbd>0</kbd> hand</span>
  <span class="hint"><kbd>.</kbd> undo</span>
  <span class="hint"><kbd>⏎</kbd> done</span>
</div>

<style>
  .hint-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-wrap: wrap;
    justify-content: center;
  }

  .state-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 8px;
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.12));
    border: 1px solid var(--theme-accent-border, rgba(99, 102, 241, 0.3));
  }

  .badge-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-accent, #6366f1);
    font-family: var(--font-mono, monospace);
  }

  .badge-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
    opacity: 0.7;
  }

  .hint-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
  }

  .hint :global(kbd) {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin-right: 2px;
  }

  @container tool-panel (max-width: 768px) {
    .hint-strip {
      display: none;
    }
  }
</style>
