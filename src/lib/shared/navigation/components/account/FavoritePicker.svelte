<!--
  FavoritePicker.svelte — Phase 2 of My Props editor.
  Shows selected props as larger cards. Tap one to crown it as favorite.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    selectedProps: PropType[];
    onfavorite: (propType: PropType) => void;
  }

  let { selectedProps, onfavorite }: Props = $props();

  let chosenProp = $state<PropType | null>(null);

  const useWideLayout = $derived(selectedProps.length > 4);

  function handlePick(prop: PropType) {
    chosenProp = prop;

    try {
      const haptic = container.items.hapticFeedback as IHapticFeedback;
      haptic?.trigger("success");
    } catch {
      // Not available
    }

    setTimeout(() => {
      onfavorite(prop);
    }, 400);
  }
</script>

<div
  class="favorite-picker"
  class:wide-layout={useWideLayout}
  role="group"
  aria-label="Choose your favorite prop"
>
  {#each selectedProps as prop (prop)}
    {@const info = getPropTypeDisplayInfo(prop)}
    <button
      class="favorite-card"
      class:chosen={chosenProp === prop}
      onclick={() => handlePick(prop)}
      disabled={chosenProp !== null}
      aria-label="Set {info.label} as favorite"
    >
      {#if chosenProp === prop}
        <span class="crown-badge" aria-hidden="true">
          <i class="fas fa-star" aria-hidden="true"></i>
        </span>
      {/if}

      <img
        src={info.image}
        alt={info.label}
        class="favorite-image"
      />
      <span class="favorite-label">{info.label}</span>
    </button>
  {/each}
</div>

<style>
  .favorite-picker {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    flex-wrap: wrap;
  }

  .favorite-picker.wide-layout {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    justify-items: center;
  }

  .favorite-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    min-width: 90px;
    min-height: 44px;
  }

  .favorite-card:hover:not(:disabled) {
    border-color: var(--theme-accent, #6366f1);
    transform: scale(1.03);
  }

  .favorite-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .favorite-card.chosen {
    border-color: var(--semantic-warning, #f59e0b);
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
  }

  .favorite-card:disabled:not(.chosen) {
    opacity: 0.5;
    cursor: default;
  }

  .crown-badge {
    position: absolute;
    top: -6px;
    left: -6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    color: var(--semantic-warning, #f59e0b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    animation: crown-pop var(--duration-normal, 200ms) ease-out;
  }

  @keyframes crown-pop {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .favorite-image {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }

  .favorite-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .favorite-card {
      transition: none;
      transform: none !important;
    }

    .crown-badge {
      animation: none;
    }
  }
</style>
