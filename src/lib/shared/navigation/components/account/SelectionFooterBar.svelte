<!--
  SelectionFooterBar.svelte - Sticky footer in My Props drawer.
  Shows miniature prop chips for each selection, count label, and CTA button.
  Hidden when 0 props selected.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  interface Props {
    selectedProps: PropType[];
    saving: boolean;
    canFinish: boolean;
    choosingFavorite: boolean;
    onfavoritepick: () => void;
    ondone: () => void;
  }

  let {
    selectedProps,
    saving,
    canFinish,
    choosingFavorite,
    onfavoritepick,
    ondone,
  }: Props = $props();

  const count = $derived(selectedProps.length);
</script>

{#if count > 0}
  <div class="selection-footer">
    <div class="selected-chips">
      {#each selectedProps as prop (prop)}
        <img
          src={getPropTypeDisplayInfo(prop).image}
          alt={getPropTypeDisplayInfo(prop).label}
          class="chip-image"
        />
      {/each}
      <span class="chip-count">{count} {count === 1 ? "prop" : "props"}</span>
    </div>

    <div class="footer-actions">
      <button
        class="footer-button favorite-button"
        class:active={choosingFavorite}
        onclick={onfavoritepick}
        aria-label={choosingFavorite
          ? "Select favorite: stop choosing"
          : "Select favorite"}
        aria-pressed={choosingFavorite}
        disabled={saving}
      >
        <i class="fas fa-star" aria-hidden="true"></i>
        <span>Select favorite</span>
      </button>

      <button
        class="footer-button cta-button"
        onclick={ondone}
        aria-label={canFinish
          ? "Done: save and close"
          : "Done: choose a favorite before closing"}
        aria-busy={saving}
        disabled={saving || !canFinish}
      >
        Done
      </button>
    </div>
  </div>
{/if}

<style>
  .selection-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .selected-chips {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    scrollbar-width: none;
  }

  .selected-chips::-webkit-scrollbar {
    display: none;
  }

  .chip-image {
    width: 24px;
    height: 24px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .chip-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .footer-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    color: white;
    border-radius: 999px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity var(--duration-fast, 150ms) ease;
    min-height: 44px;
    min-width: 44px;
  }

  .favorite-button {
    color: var(--theme-text, white);
    background: var(--theme-card-bg, #11141c);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
  }

  .favorite-button i {
    color: var(--semantic-warning, #f59e0b);
  }

  .favorite-button.active {
    color: var(--semantic-warning, #f59e0b);
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 16%,
      var(--theme-card-bg, #11141c)
    );
    border-color: var(--semantic-warning, #f59e0b);
  }

  .cta-button {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 78%, black);
    border: none;
  }

  .footer-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .footer-button:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .footer-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .chip-image {
      display: none;
    }

    .footer-button {
      padding-inline: 12px;
    }
  }

  @media (min-width: 2600px) {
    .selection-footer {
      gap: 1.25rem;
      padding: 1.25rem 2rem;
    }

    .selected-chips {
      gap: 0.5rem;
    }

    .chip-image {
      width: 3rem;
      height: 3rem;
    }

    .chip-count,
    .footer-button {
      font-size: 1.5rem;
    }

    .footer-button {
      min-height: 4.5rem;
      padding: 1rem 2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .footer-button {
      transition: none;
    }
  }
</style>
