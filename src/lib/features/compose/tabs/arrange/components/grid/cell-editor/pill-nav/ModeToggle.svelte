<script lang="ts">
  import type { EditorMode } from './types';

  let {
    mode,
    onModeChange,
  }: {
    mode: EditorMode;
    onModeChange: (mode: EditorMode) => void;
  } = $props();
</script>

<div class="mode-toggle" role="radiogroup" aria-label="Editor mode">
  <button
    class="mode-btn"
    class:active={mode === 'simple'}
    role="radio"
    aria-checked={mode === 'simple'}
    onclick={() => onModeChange('simple')}
  >
    Simple
  </button>
  <button
    class="mode-btn"
    class:active={mode === 'advanced'}
    role="radio"
    aria-checked={mode === 'advanced'}
    onclick={() => onModeChange('advanced')}
  >
    Advanced
  </button>
</div>

<style>
  .mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
  }

  .mode-btn {
    padding: 6px 16px;
    min-height: 44px;
    border-radius: var(--chip-radius, 22px);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    background: var(--surface-idle, rgba(255, 255, 255, 0.03));
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .mode-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-btn { transition: none; }
  }
</style>
