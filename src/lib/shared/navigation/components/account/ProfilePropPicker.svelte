<!-- Optional presentation step for the skill featured beside a creator name. -->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getProfilePropLabel } from "$lib/shared/community/domain/profile-prop-catalog";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";

  interface Props {
    selectedProps: PropType[];
    value: PropType | null;
    disabled?: boolean;
    onselect: (propType: PropType | null) => void;
  }

  let { selectedProps, value, disabled = false, onselect }: Props = $props();
</script>

<div
  class="profile-prop-picker"
  role="group"
  aria-label="Choose a featured prop skill"
>
  {#each selectedProps as prop (prop)}
    {@const label = getProfilePropLabel(prop)}
    <button
      type="button"
      class="profile-prop-card"
      class:selected={value === prop}
      onclick={() => onselect(prop)}
      {disabled}
      aria-pressed={value === prop}
      aria-label={`Feature ${label} on your profile`}
    >
      {#if value === prop}
        <span class="selection-mark" aria-hidden="true">
          <i class="fas fa-check"></i>
        </span>
      {/if}
      <span class="profile-prop-image" aria-hidden="true">
        <PropCompositionPreview
          propType={prop}
          size={92}
          useSavedOverrides={false}
        />
      </span>
      <span class="profile-prop-label">{label}</span>
    </button>
  {/each}

  <button
    type="button"
    class="profile-prop-card no-preference"
    class:selected={value === null}
    onclick={() => onselect(null)}
    {disabled}
    aria-pressed={value === null}
  >
    {#if value === null}
      <span class="selection-mark" aria-hidden="true">
        <i class="fas fa-check"></i>
      </span>
    {/if}
    <span class="no-preference-icon" aria-hidden="true">
      <i class="fas fa-layer-group"></i>
    </span>
    <span class="profile-prop-label">No preference</span>
    <span class="profile-prop-note">Show full list</span>
  </button>
</div>

<style>
  .profile-prop-picker {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.625rem;
    padding: 0.5rem;
  }

  .profile-prop-card {
    position: relative;
    display: flex;
    min-height: 7rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.7rem 0.6rem;
    color: var(--theme-text, white);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.85rem;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .profile-prop-card:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .profile-prop-card.selected {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
    box-shadow: 0 0 0 1px var(--theme-accent, #6366f1);
  }

  .profile-prop-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, white);
    outline-offset: 2px;
  }

  .profile-prop-card:disabled {
    opacity: 0.58;
    cursor: wait;
  }

  .selection-mark {
    position: absolute;
    top: 0.7rem;
    right: 0.7rem;
    color: var(--theme-accent, #6366f1);
  }

  .profile-prop-image,
  .no-preference-icon {
    width: 3.5rem;
    height: 3.5rem;
  }

  .profile-prop-image {
    display: grid;
    place-items: center;
  }

  .profile-prop-image :global(.prop-composition-preview) {
    width: 100%;
    height: 100%;
  }

  .no-preference-icon {
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    font-size: 1.5rem;
  }

  .profile-prop-label {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    text-align: center;
  }

  .profile-prop-note {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    line-height: 1.3;
    text-align: center;
  }

  @container (min-width: 90rem) {
    .profile-prop-picker {
      gap: 1rem;
      padding: 1rem;
    }

    .profile-prop-card {
      min-height: 11rem;
    }

    .profile-prop-image,
    .no-preference-icon {
      width: 5rem;
      height: 5rem;
    }

    .profile-prop-label {
      font-size: 1.125rem;
    }

    .profile-prop-note {
      font-size: 0.95rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .profile-prop-card {
      transition: none;
    }
  }
</style>
