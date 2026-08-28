<!-- Multi-select skill choices for families where the distinction matters. -->
<script lang="ts">
  import type { ProfilePropFamily } from "$lib/shared/community/domain/profile-prop-catalog";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  interface Props {
    family: ProfilePropFamily;
    selectedProps: PropType[];
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
  }

  let { family, selectedProps, disabled = false, ontoggle }: Props = $props();

  const selectedSet = $derived(new Set(selectedProps));
  const selectedCount = $derived(
    family.choices.filter((choice) => selectedSet.has(choice.prop)).length
  );
</script>

<section class="variant-picker" aria-labelledby="active-family-title">
  <header class="variant-heading">
    <span>
      <span class="variant-kicker">{family.label} sizes</span>
      <strong id="active-family-title">Which sizes do you spin?</strong>
    </span>
    <span class="variant-count">
      {selectedCount === 0 ? "None selected" : `${selectedCount} selected`}
    </span>
  </header>

  <div class="variant-grid" role="group" aria-labelledby="active-family-title">
    {#each family.choices as choice (choice.prop)}
      {@const selected = selectedSet.has(choice.prop)}
      <button
        type="button"
        class="variant-card"
        class:selected
        aria-pressed={selected}
        aria-label={`${choice.label}${selected ? " (selected)" : ""}`}
        onclick={() => ontoggle(choice.prop)}
        {disabled}
      >
        <span class="variant-art" aria-hidden="true">
          <PropCompositionPreview
            propType={choice.prop}
            size={96}
            useSavedOverrides={false}
          />
        </span>
        <span class="variant-label">{choice.label}</span>
        {#if selected}
          <span class="selected-mark" aria-hidden="true">
            <i class="fas fa-check"></i>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .variant-picker {
    padding: 0.85rem;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--theme-accent) 9%, transparent),
        transparent 60%
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid
      color-mix(in srgb, var(--theme-accent) 26%, var(--theme-stroke));
    border-radius: 1rem;
  }

  .variant-heading,
  .variant-heading > span:first-child {
    display: flex;
  }

  .variant-heading {
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .variant-heading > span:first-child {
    min-width: 0;
    flex-direction: column;
    gap: 0.15rem;
  }

  .variant-kicker {
    color: var(--theme-accent-text, var(--theme-accent));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .variant-heading strong {
    color: var(--theme-text, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .variant-count {
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .variant-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
  }

  .variant-card {
    position: relative;
    display: grid;
    width: calc(50% - 0.3rem);
    min-width: 0;
    min-height: 7.75rem;
    grid-template-rows: minmax(0, 1fr) auto;
    padding: 0;
    overflow: hidden;
    color: var(--theme-text, white);
    background: color-mix(in srgb, var(--theme-panel-bg, #11141c) 92%, black);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.75rem;
    cursor: pointer;
    transition:
      transform var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .variant-card:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-accent) 48%, white);
    transform: translateY(-1px);
  }

  .variant-card.selected {
    border-color: var(--theme-accent, #6366f1);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 48%, transparent),
      0 8px 22px color-mix(in srgb, var(--theme-accent) 16%, transparent);
  }

  .variant-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 72%, white);
    outline-offset: 2px;
  }

  .variant-card:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  .variant-art {
    display: grid;
    min-height: 5rem;
    place-items: center;
    padding: 0.55rem;
    background: color-mix(in srgb, var(--theme-text) 2%, transparent);
  }

  .variant-art :global(.prop-composition-preview) {
    width: min(5rem, 78%);
    height: min(5rem, 78%);
  }

  .variant-label {
    display: flex;
    min-height: 2.4rem;
    align-items: center;
    padding: 0.5rem 0.65rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 700;
    line-height: 1.2;
  }

  .selected-mark {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    place-items: center;
    color: white;
    background: color-mix(in srgb, var(--theme-accent) 82%, #090b13);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 70%, white);
    border-radius: 50%;
    font-size: 0.75rem;
  }

  @container (min-width: 40rem) {
    .variant-card {
      width: calc(33.333% - 0.4rem);
    }
  }

  @container (min-width: 70rem) {
    .variant-card {
      width: calc(16.666% - 0.5rem);
      min-height: 9rem;
    }
  }

  @container (min-width: 120rem) {
    .variant-picker {
      padding: 1.25rem;
    }

    .variant-heading strong {
      font-size: 1.5rem;
    }

    .variant-kicker,
    .variant-count,
    .variant-label {
      font-size: 1.125rem;
    }

    .variant-card {
      min-height: 13rem;
    }

    .variant-art {
      min-height: 9rem;
    }

    .variant-art :global(.prop-composition-preview) {
      width: 8rem;
      height: 8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .variant-card {
      transition: none;
    }
  }
</style>
