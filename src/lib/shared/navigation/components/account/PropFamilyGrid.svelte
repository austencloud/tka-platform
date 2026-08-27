<!-- Profile-eligible prop families with a shared variation detail stage. -->
<script lang="ts">
  import {
    PROFILE_PROP_FAMILIES,
    getProfilePropFamilyByRepresentative,
    getSelectedFamilyVariants,
  } from "$lib/shared/community/domain/profile-prop-catalog";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropFamilyCard from "./PropFamilyCard.svelte";
  import PropVariantPicker from "./PropVariantPicker.svelte";

  interface Props {
    selectedProps: PropType[];
    activeFamily: PropType | null;
    disabled?: boolean;
    onselectfamily: (representative: PropType) => void;
    ontogglevariant: (propType: PropType) => void;
  }

  let {
    selectedProps,
    activeFamily,
    disabled = false,
    onselectfamily,
    ontogglevariant,
  }: Props = $props();

  const coreFamilies = PROFILE_PROP_FAMILIES.filter(
    (family) => family.group === "core"
  );
  const specialtyFamilies = PROFILE_PROP_FAMILIES.filter(
    (family) => family.group === "specialty"
  );
  const activeFamilyInfo = $derived(
    activeFamily
      ? getProfilePropFamilyByRepresentative(activeFamily)
      : undefined
  );
</script>

<div class="family-picker">
  <section class="family-section" aria-labelledby="core-prop-families">
    <header class="section-heading">
      <span id="core-prop-families">Prop families</span>
      <small>Choose a family, then select the versions you spin.</small>
    </header>
    <div
      class="family-grid core-grid"
      role="group"
      aria-labelledby="core-prop-families"
    >
      {#each coreFamilies as family (family.representative)}
        <PropFamilyCard
          {family}
          selectedVariants={getSelectedFamilyVariants(selectedProps, family)}
          active={activeFamily === family.representative}
          {disabled}
          onselect={onselectfamily}
        />
      {/each}
    </div>
  </section>

  <section
    class="family-section specialty-section"
    aria-labelledby="specialty-prop-families"
  >
    <header class="section-heading compact">
      <span id="specialty-prop-families">Specialty shapes</span>
    </header>
    <div
      class="family-grid specialty-grid"
      role="group"
      aria-labelledby="specialty-prop-families"
    >
      {#each specialtyFamilies as family (family.representative)}
        <PropFamilyCard
          {family}
          selectedVariants={getSelectedFamilyVariants(selectedProps, family)}
          active={activeFamily === family.representative}
          {disabled}
          onselect={onselectfamily}
        />
      {/each}
    </div>
  </section>

  {#if activeFamilyInfo}
    <PropVariantPicker
      family={activeFamilyInfo}
      {selectedProps}
      {disabled}
      ontoggle={ontogglevariant}
    />
  {/if}
</div>

<style>
  .family-picker {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0 0.5rem 0.25rem;
  }

  .family-section {
    min-width: 0;
  }

  .section-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.55rem;
    color: var(--theme-text, white);
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 750;
  }

  .section-heading small {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    font-weight: 500;
  }

  .section-heading.compact {
    justify-content: flex-start;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem;
  }

  @container (min-width: 40rem) {
    .family-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .specialty-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (min-width: 70rem) {
    .core-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .family-picker {
      gap: 1.25rem;
      padding-inline: 1rem;
    }
  }

  @container (min-width: 120rem) {
    .core-grid {
      gap: 1.25rem;
    }

    .specialty-grid {
      gap: 1.25rem;
    }

    .section-heading {
      margin-bottom: 0.85rem;
      font-size: 1.5rem;
    }

    .section-heading small {
      font-size: 1.125rem;
    }
  }

  @media (max-width: 520px) {
    .section-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.2rem;
    }
  }
</style>
