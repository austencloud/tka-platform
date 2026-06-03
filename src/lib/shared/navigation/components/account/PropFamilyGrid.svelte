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
    disabled?: boolean;
    ontoggle: (propType: PropType) => void;
  }

  let { selectedProps, favoriteProp, disabled = false, ontoggle }: Props = $props();

  const selectedSet = $derived(new Set(selectedProps));
</script>

<div class="prop-family-grid" role="group" aria-label="Prop families">
  {#each PROP_FAMILIES as family (family.base)}
    <PropFamilyCard
      propType={family.base}
      label={family.label}
      selected={selectedSet.has(family.base)}
      isFavorite={favoriteProp === family.base}
      {disabled}
      {ontoggle}
    />
  {/each}
</div>

<style>
  .prop-family-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    padding: 0 8px;
  }
</style>
