<!-- Profile skill families. Only families with real skill splits open details. -->
<script lang="ts">
  import {
    PROFILE_PROP_FAMILIES,
    getProfilePropFamilyByRepresentative,
    getSelectedFamilyChoices,
  } from "$lib/shared/community/domain/profile-prop-catalog";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropFamilyCard from "./PropFamilyCard.svelte";
  import PropVariantPicker from "./PropVariantPicker.svelte";

  interface Props {
    selectedProps: PropType[];
    activeFamily: PropType | null;
    disabled?: boolean;
    onselectfamily: (representative: PropType) => void;
    ontoggleskill: (propType: PropType) => void;
  }

  let {
    selectedProps,
    activeFamily,
    disabled = false,
    onselectfamily,
    ontoggleskill,
  }: Props = $props();

  const activeFamilyInfo = $derived(
    activeFamily
      ? getProfilePropFamilyByRepresentative(activeFamily)
      : undefined
  );
</script>

<div class="family-picker">
  <div class="family-grid" role="group" aria-label="Prop skills">
    {#each PROFILE_PROP_FAMILIES as family (family.representative)}
      <PropFamilyCard
        {family}
        selectedChoices={getSelectedFamilyChoices(selectedProps, family)}
        active={activeFamily === family.representative}
        {disabled}
        onselect={onselectfamily}
      />
    {/each}
  </div>

  {#if activeFamilyInfo && activeFamilyInfo.choices.length > 1}
    <PropVariantPicker
      family={activeFamilyInfo}
      {selectedProps}
      {disabled}
      ontoggle={ontoggleskill}
    />
  {/if}
</div>

<style>
  .family-picker {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0 0.5rem 0.25rem;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem;
  }

  @container (min-width: 40rem) {
    .family-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @container (min-width: 70rem) {
    .family-grid {
      gap: 0.75rem;
    }

    .family-picker {
      gap: 0.75rem;
      padding-inline: 1rem;
    }
  }

  @container (min-width: 120rem) {
    .family-grid {
      gap: 1.25rem;
    }
  }
</style>
