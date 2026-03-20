<!--
  EffectPicker.svelte

  Shared 5-button mutually exclusive effect selector.
  Used by both AnimationSettingsModal and Visibility tab's Animation section.
  Effects: None | Fire | Charcoal | LED | Trails
-->
<script lang="ts">
  export type ActiveEffect = "none" | "fire" | "charcoal" | "led" | "trails";

  interface Props {
    activeEffect: ActiveEffect;
    onSelect: (effect: ActiveEffect) => void;
  }

  let { activeEffect, onSelect }: Props = $props();

  const effects: ReadonlyArray<{
    readonly id: ActiveEffect;
    readonly label: string;
    readonly icon: string;
    readonly iconColor?: string;
  }> = [
    { id: "none", label: "None", icon: "fa-ban" },
    { id: "fire", label: "Fire", icon: "fa-fire-flame-curved", iconColor: "#f97316" },
    { id: "charcoal", label: "Charcoal", icon: "fa-fire", iconColor: "#a855f7" },
    { id: "led", label: "LED", icon: "fa-lightbulb", iconColor: "#22c55e" },
    { id: "trails", label: "Trails", icon: "fa-wind", iconColor: "#60a5fa" },
  ];
</script>

<div class="effect-picker" role="radiogroup" aria-label="Visual effect">
  {#each effects as effect}
    <button
      class="effect-btn"
      class:active={activeEffect === effect.id}
      type="button"
      role="radio"
      aria-checked={activeEffect === effect.id}
      onclick={() => onSelect(effect.id)}
    >
      <i
        class="fas {effect.icon}"
        style={effect.iconColor && activeEffect === effect.id ? `color: ${effect.iconColor}` : ""}
        aria-hidden="true"
      ></i>
      <span>{effect.label}</span>
    </button>
  {/each}
</div>

<style>
  .effect-picker {
    display: flex;
    gap: 6px;
  }

  .effect-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .effect-btn i {
    font-size: 16px;
  }

  .effect-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .effect-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .effect-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-btn {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .effect-btn {
      border-width: 2px;
    }

    .effect-btn.active {
      border-color: var(--theme-accent);
    }

    .effect-btn:focus-visible {
      outline-width: 3px;
    }
  }
</style>
