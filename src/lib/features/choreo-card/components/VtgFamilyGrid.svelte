<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import { VTG_ELEMENTAL_THEMES } from "../domain/elemental-theme";
  import VtgFamilyCard from "./VtgFamilyCard.svelte";

  interface Props {
    decks: Deck[];
    onSelectFamily: (familyId: string) => void;
  }

  const { decks, onSelectFamily }: Props = $props();

  const familyStats = $derived(
    VTG_ELEMENTAL_THEMES.map((theme) => {
      let ratioCount = 0;
      let sequenceCount = 0;
      for (const deck of decks) {
        const family = deck.families.find((f) => f.id === theme.familyId);
        if (family) {
          ratioCount++;
          sequenceCount += family.sequenceIds.length;
        }
      }
      return { theme, ratioCount, sequenceCount };
    }),
  );
</script>

<div class="family-grid">
  {#each familyStats as { theme, ratioCount, sequenceCount } (theme.familyId)}
    <VtgFamilyCard
      {theme}
      {ratioCount}
      {sequenceCount}
      onSelect={() => onSelectFamily(theme.familyId)}
    />
  {/each}
</div>

<style>
  .family-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 1060px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .family-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
  }

  @media (max-width: 480px) {
    .family-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
</style>
