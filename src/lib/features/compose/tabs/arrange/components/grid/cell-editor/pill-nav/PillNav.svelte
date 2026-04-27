<script lang="ts">
  import type { PillId } from './types';
  import { PILL_CONFIGS } from './types';

  let {
    activePill,
    summaries,
    onPillChange,
  }: {
    activePill: PillId;
    summaries: Record<PillId, string>;
    onPillChange: (pill: PillId) => void;
  } = $props();
</script>

<nav class="pill-nav" role="tablist" aria-label="Editor sections">
  {#each PILL_CONFIGS as pill (pill.id)}
    <button
      class="pill"
      class:active={activePill === pill.id}
      role="tab"
      aria-selected={activePill === pill.id}
      aria-controls="pill-body-{pill.id}"
      onclick={() => onPillChange(pill.id)}
    >
      <span class="pill-icon"><i class="fas {pill.icon}" aria-hidden="true"></i></span>
      <span class="pill-label">{pill.label}</span>
      <span class="pill-summary">{summaries[pill.id] ?? ''}</span>
    </button>
  {/each}
</nav>

<style>
  .pill-nav {
    display: flex;
    gap: 3px;
    padding: 6px 0;
    flex-shrink: 0;
  }

  .pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 5px 2px;
    gap: 1px;
    border-radius: 8px;
    min-width: 0;
    text-align: center;
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.06));
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .pill.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
  }

  .pill-icon {
    font-size: 12px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.72);
  }

  .pill.active .pill-icon { color: var(--theme-accent, #8b5cf6); }

  .pill-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    color: rgba(255, 255, 255, 0.72);
  }

  .pill.active .pill-label { color: var(--theme-accent, #8b5cf6); }

  .pill-summary {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .pill.active .pill-summary { color: var(--theme-accent, #8b5cf6); }

  @media (prefers-reduced-motion: reduce) {
    .pill { transition: none; }
  }
</style>
