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
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    padding: 3px;
    background: color-mix(in srgb, var(--theme-text) 3%, transparent);
    border-radius: var(--border-radius-md, 8px);
  }

  .mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 48px;
    padding: 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease;
  }

  .mode-btn:hover {
    color: var(--theme-text, white);
    background: color-mix(in srgb, var(--theme-text) 6%, transparent);
  }

  .mode-btn.active {
    color: var(--mode-color);
    background: var(--mode-color-mid);
    box-shadow: 0 1px 3px var(--theme-overlay-dark, rgba(0, 0, 0, 0.2));
  }

  .mode-btn i {
    font-size: var(--font-size-compact, 12px);
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
