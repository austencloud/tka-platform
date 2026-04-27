<script lang="ts">
  import type { EffectType, TipEffectMap } from '$lib/shared/animation-engine/domain/types/TipEffectTypes';
  import { TrailMode } from '$lib/shared/animation-engine/domain/types/TrailTypes';
  import UnifiedEffectsSection from '../../sections/UnifiedEffectsSection.svelte';

  let {
    currentEffect = 'none' as EffectType,
    currentTrailMode,
    tipEffectMap = {} as TipEffectMap,
    onSetEffect,
    onSetTrailMode,
    onUpdateTipEffectMap,
  }: {
    currentEffect: EffectType;
    currentTrailMode?: TrailMode;
    tipEffectMap?: TipEffectMap;
    onSetEffect: (effect: EffectType) => void;
    onSetTrailMode?: (mode: TrailMode) => void;
    onUpdateTipEffectMap?: (map: TipEffectMap) => void;
  } = $props();

  interface EffectDef {
    id: EffectType;
    icon: string;
    color: string;
  }

  const EFFECTS: EffectDef[] = [
    { id: 'trails', icon: 'fa-route', color: '#60a5fa' },
    { id: 'fire', icon: 'fa-fire', color: '#f97316' },
    { id: 'led', icon: 'fa-lightbulb', color: '#22c55e' },
    { id: 'charcoal', icon: 'fa-diamond', color: '#78716c' },
    { id: 'zap', icon: 'fa-bolt', color: '#eab308' },
    { id: 'sparkles', icon: 'fa-star', color: '#f59e0b' },
    { id: 'echo', icon: 'fa-clone', color: '#8b5cf6' },
    { id: 'bloom', icon: 'fa-sun', color: '#fbbf24' },
    { id: 'water', icon: 'fa-droplet', color: '#06b6d4' },
    { id: 'bubbles', icon: 'fa-circle-notch', color: '#67e8f9' },
    { id: 'petals', icon: 'fa-leaf', color: '#f472b6' },
    { id: 'smoke', icon: 'fa-smog', color: '#94a3b8' },
    { id: 'ink', icon: 'fa-paint-brush', color: '#475569' },
    { id: 'frost', icon: 'fa-snowflake', color: '#7dd3fc' },
    { id: 'silk', icon: 'fa-wind', color: '#c084fc' },
    { id: 'pulse', icon: 'fa-bullseye', color: '#ef4444' },
  ];

  let showCustomize = $state(false);

  function isActive(effectId: EffectType): boolean {
    return currentEffect === effectId;
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
</script>

<div class="effects-body">
  <span class="section-label">SELECT EFFECT</span>
  <div class="effect-grid">
    {#each EFFECTS as effect (effect.id)}
      <button
        class="effect-btn"
        class:active={isActive(effect.id)}
        style:--effect-color={effect.color}
        title={capitalize(effect.id)}
        onclick={() => onSetEffect(effect.id)}
      >
        <i class="fas {effect.icon}" aria-hidden="true"></i>
      </button>
    {/each}
  </div>

  {#if currentEffect !== 'none'}
    <button
      class="accordion-row"
      onclick={() => showCustomize = !showCustomize}
    >
      <span class="accordion-title">Customize {capitalize(currentEffect)}</span>
      <i class="fas fa-chevron-{showCustomize ? 'down' : 'right'}" aria-hidden="true"></i>
    </button>

    {#if showCustomize}
      <UnifiedEffectsSection
        currentEffect={currentEffect as any}
        {currentTrailMode}
        currentMap={tipEffectMap}
        bluePropType="staff"
        redPropType="staff"
        onSetEffect={effect => onSetEffect(effect as EffectType)}
        onSetTrailMode={mode => onSetTrailMode?.(mode)}
        onUpdateMap={map => onUpdateTipEffectMap?.(map)}
      />
    {/if}
  {/if}
</div>

<style>
  .effects-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .effect-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .effect-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--action-radius, 8px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .effect-btn i { font-size: 18px; }

  .effect-btn:hover:not(.active) {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
  }

  .effect-btn.active {
    border: 1.5px solid var(--effect-color);
    background: color-mix(in srgb, var(--effect-color) 14%, transparent);
    color: var(--effect-color);
  }

  .accordion-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 8px 10px;
    background: var(--surface-idle, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.06));
    border-radius: var(--action-radius, 8px);
    cursor: pointer;
    transition: background 150ms ease;
  }

  .accordion-row:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.06));
  }

  .accordion-title {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.75);
  }

  .accordion-row i {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-btn, .accordion-row { transition: none; }
  }
</style>
