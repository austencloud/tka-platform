<!--
LOOPModeSelector.svelte - Clear segmented control for single vs multi-select mode
Makes the two modes immediately browseable and self-explanatory
-->
<script lang="ts">
  let { isMultiSelectMode, onModeChange } = $props<{
    isMultiSelectMode: boolean;
    onModeChange: (isMulti: boolean) => void;
  }>();
</script>

<div class="mode-selector">
  <button
    class="mode-option"
    class:active={!isMultiSelectMode}
    onclick={() => onModeChange(false)}
    aria-pressed={!isMultiSelectMode}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke-opacity="0.4" />
    </svg>
    <span class="mode-label">Quick Apply</span>
    <span class="mode-hint">Tap one to apply</span>
  </button>

  <button
    class="mode-option"
    class:active={isMultiSelectMode}
    onclick={() => onModeChange(true)}
    aria-pressed={isMultiSelectMode}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <polyline points="5,6 6,7 9,4" stroke-width="1.5" />
      <polyline points="16,6 17,7 20,4" stroke-width="1.5" />
    </svg>
    <span class="mode-label">Build Combo</span>
    <span class="mode-hint">Select multiple</span>
  </button>
</div>

<style>
  .mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
  }

  .mode-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: transparent;
    border: 2px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .mode-option:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, white);
  }

  .mode-option.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: var(--theme-text, white);
  }

  .mode-option.active:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    border-color: var(--theme-accent, #6366f1);
  }

  .mode-option svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .mode-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    text-align: center;
  }

  .mode-hint {
    font-size: var(--font-size-xs, 12px);
    opacity: 0.7;
    text-align: center;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mode-option {
      transition: none;
    }
  }
</style>
