<!-- One profile skill. Hoop is the only family that opens a size choice. -->
<script lang="ts">
  import type { ProfilePropFamily } from "$lib/shared/community/domain/profile-prop-catalog";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  interface Props {
    family: ProfilePropFamily;
    selectedChoices: PropType[];
    active: boolean;
    disabled?: boolean;
    onselect: (representative: PropType) => void;
  }

  let {
    family,
    selectedChoices,
    active,
    disabled = false,
    onselect,
  }: Props = $props();

  const selected = $derived(selectedChoices.length > 0);
  const hasChoices = $derived(family.choices.length > 1);
  const previewProp = $derived(
    selectedChoices[selectedChoices.length - 1] ?? family.representative
  );
  const selectionSummary = $derived(
    family.choices
      .filter((choice) => selectedChoices.includes(choice.prop))
      .map((choice) => choice.label)
      .join(", ")
  );
</script>

<button
  type="button"
  class="family-card"
  class:selected
  class:active
  onclick={() => onselect(family.representative)}
  aria-pressed={selected}
  {disabled}
>
  <span class="art-stage" aria-hidden="true">
    <PropCompositionPreview
      propType={previewProp}
      size={64}
      useSavedOverrides={false}
    />
    {#if selected}
      <span class="selection-mark"><i class="fas fa-check"></i></span>
    {:else}
      <span class="add-mark"><i class="fas fa-plus"></i></span>
    {/if}
  </span>
  <span class="card-copy">
    <strong>{family.label}</strong>
    <small
      >{selected && hasChoices ? selectionSummary : family.description}</small
    >
  </span>
  {#if hasChoices}
    <span class="detail-cue" aria-hidden="true">
      <i class="fas fa-chevron-right"></i>
    </span>
  {/if}
</button>

<style>
  .family-card {
    position: relative;
    display: grid;
    grid-template-columns: 3.25rem minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 5.25rem;
    align-items: center;
    gap: 0.65rem;
    padding: 0.7rem;
    color: var(--theme-text, white);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.85rem;
    cursor: pointer;
    text-align: left;
    transition:
      transform var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .family-card:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
    transform: translateY(-1px);
  }

  .family-card.selected {
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-accent) 9%,
      var(--theme-card-bg)
    );
  }

  .family-card.active {
    border-color: var(--theme-accent, #6366f1);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 50%, transparent),
      0 0 18px color-mix(in srgb, var(--theme-accent) 18%, transparent);
  }

  .family-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 72%, white);
    outline-offset: 2px;
  }

  .family-card:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  .art-stage {
    position: relative;
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    place-items: center;
    border-radius: 0.7rem;
    background: color-mix(in srgb, var(--theme-text) 4%, transparent);
  }

  .art-stage :global(.prop-composition-preview) {
    width: 80%;
    height: 80%;
  }

  .selection-mark,
  .add-mark {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    display: grid;
    width: 1.35rem;
    height: 1.35rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 75%, white);
    border-radius: 50%;
    color: white;
    background: color-mix(in srgb, var(--theme-accent) 82%, #090b13);
    font-size: 0.875rem;
    font-weight: 850;
  }

  .add-mark {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    background: var(--theme-panel-bg, #11141c);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .card-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
  }

  .card-copy strong,
  .card-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-copy strong {
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .card-copy small {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
  }

  .detail-cue {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.75rem;
  }

  @container (min-width: 120rem) {
    .family-card {
      grid-template-columns: 5rem minmax(0, 1fr) auto;
      min-height: 7rem;
      gap: 1rem;
      padding: 1rem;
    }

    .art-stage {
      width: 5rem;
      height: 5rem;
    }

    .card-copy strong {
      font-size: 1.5rem;
    }

    .card-copy small {
      font-size: 1.125rem;
    }
  }

  @media (max-width: 520px) {
    .family-card {
      grid-template-columns: 2.75rem minmax(0, 1fr);
      min-height: 4.5rem;
      gap: 0.45rem;
      padding: 0.55rem;
    }

    .art-stage {
      width: 2.75rem;
      height: 2.75rem;
    }

    .card-copy small,
    .detail-cue {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .family-card {
      transition: none;
    }
  }
</style>
