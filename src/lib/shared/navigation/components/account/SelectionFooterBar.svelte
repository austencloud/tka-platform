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
    onadvance: () => void;
    ondone: () => void;
  }

  let { selectedProps, saving, onadvance, ondone }: Props = $props();

  const count = $derived(selectedProps.length);
  const showSetFavorite = $derived(count >= 2);
  const ctaLabel = $derived(showSetFavorite ? "Set favorite" : "Done");
  const ctaAriaLabel = $derived(
    showSetFavorite
      ? `Set favorite from ${count} selected props`
      : "Save and close"
  );

  function handleCta() {
    if (showSetFavorite) {
      onadvance();
    } else {
      ondone();
    }
  }
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

    <button
      class="cta-button"
      onclick={handleCta}
      aria-label={ctaAriaLabel}
    >
      {ctaLabel}
      {#if showSetFavorite}
        <i class="fas fa-arrow-right cta-arrow" aria-hidden="true"></i>
      {/if}
    </button>
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

  .cta-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border: none;
    border-radius: 999px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity var(--duration-fast, 150ms) ease;
    min-height: 36px;
    min-width: 44px;
  }

  .cta-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .cta-button:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .cta-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cta-arrow {
    font-size: 10px;
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-button {
      transition: none;
    }
  }
</style>
