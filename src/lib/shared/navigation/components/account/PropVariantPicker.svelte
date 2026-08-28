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
</script>

<section
  class="variant-picker"
  id="prop-family-skill-choices"
  aria-labelledby="active-family-title"
>
  <header class="variant-heading">
    <strong id="active-family-title">{family.label} size</strong>
    <span>Choose one or both</span>
  </header>

  <div class="variant-grid" role="group" aria-labelledby="active-family-title">
    {#each family.choices as choice (choice.prop)}
      {@const selected = selectedSet.has(choice.prop)}
      <button
        type="button"
        class="size-choice"
        class:selected
        aria-pressed={selected}
        aria-label={`${choice.label}${selected ? " (selected)" : ""}`}
        onclick={() => ontoggle(choice.prop)}
        {disabled}
      >
        <span class="choice-art" aria-hidden="true">
          <PropCompositionPreview
            propType={choice.prop}
            size={48}
            useSavedOverrides={false}
          />
        </span>
        <span class="choice-label">{choice.label}</span>
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
    padding: 0.65rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid
      color-mix(in srgb, var(--theme-accent) 26%, var(--theme-stroke));
    border-radius: 0.85rem;
  }

  .variant-heading {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--theme-text, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .variant-heading span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.75rem, var(--font-size-compact, 0.75rem));
  }

  .variant-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .size-choice {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 4.5rem;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 2.5rem 0.5rem 0.6rem;
    color: var(--theme-text, white);
    background: color-mix(in srgb, var(--theme-panel-bg, #11141c) 92%, black);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.65rem;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .size-choice:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-accent) 48%, white);
  }

  .size-choice.selected {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--theme-accent) 48%, transparent);
  }

  .size-choice:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 72%, white);
    outline-offset: 2px;
  }

  .size-choice:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  .choice-art {
    display: grid;
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
    place-items: center;
  }

  .choice-art :global(.prop-composition-preview) {
    width: 100%;
    height: 100%;
  }

  .choice-label {
    color: var(--theme-text, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 700;
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

  @container (min-width: 120rem) {
    .variant-picker {
      padding: 1rem;
    }

    .variant-heading,
    .choice-label {
      font-size: 1.125rem;
    }

    .variant-heading span {
      font-size: 1rem;
    }

    .size-choice {
      min-height: 6rem;
      padding: 0.75rem 3rem 0.75rem 0.85rem;
    }

    .choice-art {
      width: 4.5rem;
      height: 4.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .size-choice {
      transition: none;
    }
  }
</style>
