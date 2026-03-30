<script lang="ts">
  const EFFECTS = [
    { id: "none", label: "None", icon: "fa-ban", color: "" },
    { id: "fire", label: "Fire", icon: "fa-fire", color: "#f97316" },
    { id: "led", label: "LED", icon: "fa-lightbulb", color: "#22c55e" },
    { id: "trails", label: "Trails", icon: "fa-route", color: "#60a5fa" },
    { id: "charcoal", label: "Coal", icon: "fa-diamond", color: "#a855f7" },
  ] as const;

  interface Props {
    activeEffect: string;
    onSelect: (effect: string) => void;
  }

  const { activeEffect, onSelect }: Props = $props();

  function getButtonStyle(effect: (typeof EFFECTS)[number]): string {
    const isActive = activeEffect === effect.id;
    if (!isActive) return "";

    if (!effect.color) {
      return [
        "border-color: var(--theme-text, white)",
        "background: color-mix(in srgb, var(--theme-text) 8%, transparent)",
        "color: var(--theme-text, white)",
      ].join("; ");
    }

    return [
      `border-color: ${effect.color}`,
      `background: color-mix(in srgb, ${effect.color} 12%, transparent)`,
      `color: ${effect.color}`,
    ].join("; ");
  }
</script>

<div
  class="effect-selector"
  role="radiogroup"
  aria-label="Select effect"
>
  {#each EFFECTS as effect (effect.id)}
    {@const isActive = activeEffect === effect.id}
    <button
      type="button"
      class="effect-btn"
      class:active={isActive}
      role="radio"
      aria-checked={isActive}
      aria-label={effect.label}
      style={getButtonStyle(effect)}
      onclick={() => onSelect(effect.id)}
    >
      <i class="fas {effect.icon}" aria-hidden="true"></i>
      <span class="effect-label">{effect.label}</span>
    </button>
  {/each}
</div>

<style>
  .effect-selector {
    display: flex;
    gap: 6px;
  }

  .effect-btn {
    flex: 1;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    border-radius: 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: inherit;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--duration-fast, 100ms) ease,
      border-color var(--duration-fast, 100ms) ease,
      color var(--duration-fast, 100ms) ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-btn {
      transition: none;
    }
  }

  .effect-btn:hover:not(.active) {
    background: color-mix(
      in srgb,
      var(--theme-text, white) 6%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .effect-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .effect-btn i {
    font-size: 14px;
    pointer-events: none;
  }

  .effect-label {
    font-size: 11px;
    line-height: 1;
    pointer-events: none;
    white-space: nowrap;
  }
</style>
