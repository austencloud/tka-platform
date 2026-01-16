<!--
  QuickBpmPresets.svelte

  Quick BPM preset selector for mobile compact mode.
  Shows 4 preset buttons (30, 60, 90, 120 BPM) for quick speed changes.
-->
<script lang="ts">
  let {
    bpm = 60,
    presets = [30, 60, 90, 120],
    onBpmChange = () => {},
  }: {
    bpm?: number;
    presets?: number[];
    onBpmChange?: (bpm: number) => void;
  } = $props();
</script>

<div class="quick-presets">
  {#each presets as presetBpm}
    <button
      class="quick-preset-btn"
      class:active={bpm === presetBpm}
      onclick={() => onBpmChange(presetBpm)}
      type="button"
      aria-label="Set BPM to {presetBpm}"
    >
      {presetBpm}
    </button>
  {/each}
</div>

<style>
  /* Quick BPM Presets (Mobile Compact) */
  .quick-presets {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .quick-preset-btn {
    flex: 1;
    min-width: 0;
    min-height: var(--min-touch-target);
    padding: 10px 8px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text, var(--theme-text-dim));
    font-size: clamp(0.75rem, 2.5vw, 0.85rem);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    font-variant-numeric: tabular-nums;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 var(--theme-card-bg);
  }

  @media (hover: hover) and (pointer: fine) {
    .quick-preset-btn:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
      transform: translateY(-1px);
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.15),
        inset 0 1px 0 var(--theme-card-hover-bg);
    }
  }

  .quick-preset-btn:active {
    transform: scale(0.97);
  }

  .quick-preset-btn.active {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.3) 0%,
      rgba(124, 58, 237, 0.25) 100%
    );
    border-color: rgba(139, 92, 246, 0.5);
    color: rgba(255, 255, 255, 1);
    box-shadow:
      0 0 20px rgba(139, 92, 246, 0.25),
      0 2px 8px rgba(139, 92, 246, 0.2),
      inset 0 1px 0 var(--theme-stroke);
  }

  .quick-preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .quick-preset-btn {
      transition: none;
    }
  }
</style>
