<!--
  FavoritePicker.svelte - Phase 2 of My Props editor.
  Shows selected props as larger cards. Tap one to crown it as favorite.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  interface Props {
    selectedProps: PropType[];
    onfavorite: (propType: PropType) => void;
  }

  let { selectedProps, onfavorite }: Props = $props();

  let chosenProp = $state<PropType | null>(null);

  // No longer need layout switching - grid auto-fills

  function handlePick(prop: PropType) {
    chosenProp = prop;

    try {
      const haptic = getHapticFeedback() as HapticFeedback;
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
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    padding: 16px 8px;
  }

  .favorite-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
    padding: 12px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    min-height: var(--min-touch-target, 50px);
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
    width: clamp(40px, 50%, 72px);
    height: auto;
    aspect-ratio: 1;
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
