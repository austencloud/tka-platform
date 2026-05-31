<!-- PropFamilyCard.svelte - Individual toggleable prop family card -->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  interface Props {
    propType: PropType;
    label: string;
    selected: boolean;
    isFavorite: boolean;
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
  }

  let { propType, label, selected, isFavorite, disabled = false, ontoggle }: Props = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  function handleClick() {
    if (!disabled) {
      ontoggle(propType);
    }
  }
</script>

<button
  class="prop-family-card"
  class:selected
  class:disabled
  aria-pressed={selected}
  aria-label="{label}{selected ? ' (selected)' : ''}{isFavorite ? ' (favorite)' : ''}"
  onclick={handleClick}
  {disabled}
  style:border-color={selected ? 'var(--theme-accent, #6366f1)' : undefined}
  style:background={selected ? 'color-mix(in srgb, var(--theme-accent) 15%, transparent)' : undefined}
  style:box-shadow={selected ? '0 0 0 1px var(--theme-accent, #6366f1), 0 0 16px color-mix(in srgb, var(--theme-accent) 30%, transparent)' : undefined}
>
  {#if isFavorite}
    <span class="favorite-badge" aria-label="Favorite">
      <i class="fas fa-star" aria-hidden="true"></i>
    </span>
  {/if}

  {#if selected}
    <span class="check-badge" aria-hidden="true">
      <i class="fas fa-check" aria-hidden="true"></i>
    </span>
  {/if}

  <img
    src={displayInfo.image}
    alt={label}
    class="prop-image"
    loading="lazy"
  />
  <span class="prop-label">{label}</span>
</button>

<style>
  .prop-family-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    padding: 12px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    min-height: var(--min-touch-target, 50px);
    min-width: var(--min-touch-target, 50px);
  }

  .prop-family-card:hover:not(.disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .prop-family-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .prop-family-card.selected {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    box-shadow:
      0 0 0 1px var(--theme-accent, #6366f1),
      0 0 16px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .prop-family-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .check-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
  }

  .favorite-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    color: var(--semantic-warning, #f59e0b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
  }

  .prop-image {
    width: clamp(40px, 50%, 72px);
    height: auto;
    aspect-ratio: 1;
    object-fit: contain;
  }

  .prop-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    line-height: 1.2;
  }

  .selected .prop-label {
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-family-card {
      transition: none;
      transform: none !important;
    }
  }
</style>
