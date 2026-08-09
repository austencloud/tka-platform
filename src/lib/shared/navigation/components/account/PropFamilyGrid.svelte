<!-- PropFamilyGrid.svelte - Curated grid of base prop families with multi-select -->
<script lang="ts" module>
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  export interface PropFamily {
    base: PropType;
    label: string;
  }

  /**
   * The 16 curated prop families users can select from.
   * Quiad excluded (internal test prop). Poi excluded (restricted subset, not static).
   */
  export const PROP_FAMILIES: PropFamily[] = [
    // Staves & Clubs
    { base: PropType.STAFF, label: "Staff" },
    { base: PropType.CLUB, label: "Club" },
    { base: PropType.FAN, label: "Fan" },
    // Curved Props
    { base: PropType.BUUGENG, label: "Buugeng" },
    { base: PropType.TRIGENG, label: "Trigeng" },
    { base: PropType.MINIHOOP, label: "Hoop" },
    { base: PropType.TRIAD, label: "Triad" },
    { base: PropType.TRIQUETRA, label: "Triquetra" },
    // Novelty
    { base: PropType.CHICKEN, label: "Chicken" },
    { base: PropType.GUITAR, label: "Guitar" },
    { base: PropType.DOUBLESTAR, label: "Double Star" },
    { base: PropType.EIGHTRINGS, label: "Eight Rings" },
    { base: PropType.CONTACTBALL, label: "Contact Ball" },
    { base: PropType.TORCH, label: "Torch" },
    // Other
    { base: PropType.HAND, label: "Hand" },
    { base: PropType.SWORD, label: "Sword" },
  ];
</script>

<script lang="ts">
  import PropFamilyCard from "./PropFamilyCard.svelte";

  interface Props {
    selectedProps: PropType[];
    favoriteProp: PropType | null;
    choosingFavorite: boolean;
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
    onfavorite: (propType: PropType) => void;
  }

  let {
    selectedProps,
    favoriteProp,
    choosingFavorite,
    disabled = false,
    ontoggle,
    onfavorite,
  }: Props = $props();

  const selectedSet = $derived(new Set(selectedProps));
</script>

<div class="prop-family-grid" role="group" aria-label="Prop families">
  {#each PROP_FAMILIES as family (family.base)}
    <PropFamilyCard
      propType={family.base}
      label={family.label}
      selected={selectedSet.has(family.base)}
      isFavorite={favoriteProp === family.base}
      {choosingFavorite}
      {disabled}
      {ontoggle}
      {onfavorite}
    />
  {/each}
</div>

<style>
  .prop-family-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem;
    padding: 0 0.5rem;
  }

  @container (min-width: 28rem) {
    .prop-family-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @container (min-width: 40rem) {
    .prop-family-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  @container (min-width: 56rem) {
    .prop-family-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }

  @container (min-width: 90rem) {
    .prop-family-grid {
      gap: 1rem;
      padding: 0 1rem;
    }
  }

  @container (min-width: 140rem) {
    .prop-family-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1.25rem;
    }
  }
</style>
