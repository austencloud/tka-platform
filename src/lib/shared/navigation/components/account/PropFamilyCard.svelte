<!-- PropFamilyCard.svelte — Individual toggleable prop family card -->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

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
    gap: 6px;
    position: relative;
    padding: 10px 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    min-height: 44px;
    min-width: 44px;
    aspect-ratio: 1 / 1;
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
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    transform: scale(1.02);
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
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .prop-label {
    font-size: var(--font-size-compact, 12px);
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
