<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { TND_ELEMENTS } from "../domain/tnd-element";
  import VtgFamilyCard from "./VtgFamilyCard.svelte";

  interface Props {
    catalogs: Catalog[];
    onSelectFamily: (familyId: string) => void;
  }

  const { catalogs, onSelectFamily }: Props = $props();

  const familyStats = $derived(
    TND_ELEMENTS.map((theme) => {
      let ratioCount = 0;
      let sequenceCount = 0;
      for (const catalog of catalogs) {
        const family = catalog.families.find((f) => f.id === theme.familyId);
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
