<!--
  MyPropsCard.svelte

  Compact section in Account popover showing the user's prop preferences.
  Tapping opens a drawer/sheet for full prop selection using BentoPropGrid.
-->
<script lang="ts">
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";

  interface Props {
    propState: PropPreferenceState | null;
    onOpenPropEditor: () => void;
  }

  let { propState, onOpenPropEditor }: Props = $props();

  const favoriteProp = $derived(propState?.favoriteProp ?? null);
  const propsCount = $derived(propState?.propsISpinWith.length ?? 0);
  const loading = $derived(propState?.loading ?? true);
</script>

{#if !loading}
  <button
    class="my-props-card"
    onclick={onOpenPropEditor}
    aria-label={favoriteProp ? `My props: ${getPropTypeDisplayInfo(favoriteProp).label}` : "Pick your props"}
  >
    <div class="props-icon">
      {#if favoriteProp}
        <img
          src={getPropTypeDisplayInfo(favoriteProp).image}
          alt={getPropTypeDisplayInfo(favoriteProp).label}
          class="fav-prop-img"
        />
      {:else}
        <i class="fas fa-fire" aria-hidden="true"></i>
      {/if}
    </div>
    <div class="props-info">
      {#if favoriteProp}
        <span class="props-label">{getPropTypeDisplayInfo(favoriteProp).label}</span>
        {#if propsCount > 1}
          <span class="props-count">+{propsCount - 1} more</span>
        {/if}
      {:else}
        <span class="props-label">Pick your props</span>
        <span class="props-count">What do you spin?</span>
      {/if}
    </div>
    <i class="fas fa-chevron-right props-arrow" aria-hidden="true"></i>
  </button>
{/if}

<style>
  .my-props-card {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    margin: 0;
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .my-props-card:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .my-props-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .props-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--theme-accent, #6366f1);
    font-size: 16px;
  }

  .fav-prop-img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .props-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .props-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .props-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .props-arrow {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .my-props-card {
      transition: none;
    }
  }
</style>
