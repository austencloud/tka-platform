<!-- PropFamilyCard.svelte - Individual toggleable prop family card -->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  interface Props {
    propType: PropType;
    label: string;
    selected: boolean;
    isFavorite: boolean;
    choosingFavorite: boolean;
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
    onfavorite: (propType: PropType) => void;
  }

  let {
    propType,
    label,
    selected,
    isFavorite,
    choosingFavorite,
    disabled = false,
    ontoggle,
    onfavorite,
  }: Props = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  function handleClick() {
    if (disabled) return;

    if (choosingFavorite) {
      if (!selected) return;
      onfavorite(propType);
      return;
    }

    ontoggle(propType);
  }
</script>

<div
  class="prop-family-card"
  class:selected
  class:disabled
  class:favorite-picking={choosingFavorite}
  class:favorite-candidate={choosingFavorite && selected}
  style:border-color={selected ? "var(--theme-accent, #6366f1)" : undefined}
  style:background={selected
    ? "color-mix(in srgb, var(--theme-accent) 15%, transparent)"
    : undefined}
  style:box-shadow={selected
    ? "0 0 0 1px var(--theme-accent, #6366f1), 0 0 16px color-mix(in srgb, var(--theme-accent) 30%, transparent)"
    : undefined}
>
  <button
    class="prop-family-toggle"
    aria-pressed={choosingFavorite ? isFavorite : selected}
    aria-label={choosingFavorite
      ? selected
        ? `Choose ${label} as favorite${isFavorite ? " (current favorite)" : ""}`
        : `${label} is not selected`
      : `${label}${selected ? " (selected)" : ""}${isFavorite ? " (favorite)" : ""}`}
    onclick={handleClick}
    disabled={disabled || (choosingFavorite && !selected)}
  >
    <img
      src={displayInfo.image}
      alt={label}
      class="prop-image"
      loading="lazy"
    />
    <span class="prop-label">
      {#if selected}
        <i class="fas fa-check selected-check" aria-hidden="true"></i>
      {/if}
      {label}
    </span>
  </button>

  {#if selected && isFavorite}
    <div
      class="favorite-status"
      role="status"
      aria-label={`${label} is your favorite`}
    >
      <i class="fas fa-star" aria-hidden="true"></i>
      <span>Favorite</span>
    </div>
  {/if}
</div>

<style>
  .prop-family-card {
    position: relative;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease,
      opacity var(--duration-fast, 150ms) ease;
    min-height: var(--min-touch-target, 50px);
    min-width: var(--min-touch-target, 50px);
    overflow: hidden;
  }

  .prop-family-card:hover:not(.disabled),
  .prop-family-card:focus-within:not(.disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .prop-family-toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 100%;
    padding: 12px 8px;
    color: inherit;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .prop-family-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, white);
    outline-offset: -3px;
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
  }

  .favorite-picking:not(.favorite-candidate) {
    opacity: 0.42;
  }

  .prop-family-toggle:disabled {
    cursor: not-allowed;
  }

  .favorite-status {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    min-height: 28px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
    top: 8px;
    left: 8px;
    gap: 5px;
    color: var(--semantic-warning, #f59e0b);
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 16%,
      var(--theme-card-bg, #11141c)
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning, #f59e0b) 68%, transparent);
  }

  .prop-image {
    width: clamp(40px, 50%, 72px);
    height: auto;
    aspect-ratio: 1;
    object-fit: contain;
  }

  .prop-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    line-height: 1.2;
  }

  .selected-check {
    color: var(--theme-accent, #6366f1);
    font-size: 0.8em;
  }

  .selected .prop-label {
    color: var(--theme-text, white);
  }

  @media (hover: hover) and (pointer: fine) {
    .favorite-candidate .prop-family-toggle {
      cursor:
        url("/cursors/favorite-star.svg") 16 16,
        crosshair;
    }

    .favorite-candidate:hover {
      border-color: var(--semantic-warning, #f59e0b) !important;
    }
  }

  @container (min-width: 90rem) {
    .prop-family-toggle {
      gap: 0.75rem;
      padding: 1.5rem 1rem;
    }

    .favorite-status {
      min-height: 2rem;
      padding: 0 0.75rem;
      font-size: 1rem;
    }

    .prop-image {
      width: clamp(5rem, 50%, 8rem);
    }

    .prop-label {
      font-size: 1.125rem;
    }
  }

  @container (min-width: 140rem) {
    .prop-family-toggle {
      gap: 1rem;
      padding: 2rem 1.5rem;
    }

    .favorite-status {
      min-height: 2.5rem;
      padding: 0 1rem;
      font-size: 1.25rem;
    }

    .prop-image {
      width: clamp(8rem, 48%, 12rem);
    }

    .prop-label {
      font-size: 1.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-family-card {
      transition: none;
      transform: none !important;
    }
  }
</style>
