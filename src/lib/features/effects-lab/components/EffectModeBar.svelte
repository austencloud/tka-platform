<!--
  EffectModeBar.svelte

  Horizontal mode switcher for the Effects Lab.
  Displays Trails / Fire / LED buttons with effect-specific accent colors.
-->
<script lang="ts">
  import { EFFECT_DESCRIPTORS, type EffectMode } from "../domain/EffectDescriptor";

  interface Props {
    activeMode: EffectMode;
    onModeChange: (mode: EffectMode) => void;
  }
  let { activeMode, onModeChange }: Props = $props();
</script>

<div class="mode-bar" role="tablist" aria-label="Effect type">
  {#each EFFECT_DESCRIPTORS as desc}
    {@const isActive = activeMode === desc.id}
    <button
      role="tab"
      class="mode-btn"
      class:active={isActive}
      aria-selected={isActive}
      style="--mode-color: {desc.accentColor}; --mode-color-mid: {desc.accentColorMid}; --mode-color-border: {desc.accentColorBorder}"
      onclick={() => onModeChange(desc.id as EffectMode)}
    >
      <i class={desc.icon} aria-hidden="true"></i>
      {desc.label}
    </button>
  {/each}
</div>

<style>
  .mode-bar {
    display: flex;
    gap: var(--spacing-xs, 4px);
    padding: 0 var(--spacing-lg, 24px);
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 16px;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
    background: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
  }

  .mode-btn:hover {
    color: var(--theme-text, white);
    background: var(--mode-color-mid);
  }

  .mode-btn.active {
    color: var(--mode-color);
    background: var(--mode-color-mid);
    border-color: var(--mode-color-border);
    border-bottom-color: transparent;
  }

  .mode-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-btn {
      transition: none;
    }
  }
</style>
