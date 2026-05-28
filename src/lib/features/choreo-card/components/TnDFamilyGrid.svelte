<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { TND_ELEMENTS } from "../domain/tnd-element";
  import TnDFamilyCard from "./TnDFamilyCard.svelte";
  import TnDReversalStrip from "./TnDReversalStrip.svelte";

  interface Props {
    catalogs: Catalog[];
    onSelectFamily: (familyId: string) => void;
    activePatternId?: string | null;
    onPatternChange?: (resolved: import("../domain/reversal-transform").ResolvedReversalPattern) => void;
    seedPanel?: import("svelte").Snippet;
  }

  const {
    catalogs,
    onSelectFamily,
    activePatternId = null,
    onPatternChange,
    seedPanel,
  }: Props = $props();

  // Asymmetric enumerations reference a base deck's sequences and store none of their own —
  // counting them inflates the total far beyond what the drilldown can actually load.
  const materializedCatalogs = $derived(catalogs.filter((c) => !c.asymmetric));

  const familyStats = $derived(
    TND_ELEMENTS.map((theme) => {
      let ratioCount = 0;
      let sequenceCount = 0;
      for (const catalog of materializedCatalogs) {
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

<div class="family-stage">
  <div class="family-grid">
    {#each familyStats as { theme, ratioCount, sequenceCount } (theme.familyId)}
      <TnDFamilyCard
        {theme}
        {ratioCount}
        {sequenceCount}
        onSelect={() => onSelectFamily(theme.familyId)}
      />
    {/each}
  </div>
  {#if onPatternChange}
    <TnDReversalStrip {activePatternId} {onPatternChange} />
  {/if}
  {#if seedPanel}{@render seedPanel()}{/if}
</div>

<style>
  /* Six modes plus the reversal strip stack in a centered column. */
  .family-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    min-height: auto;
    padding: 40px 24px;
    box-sizing: border-box;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 28px;
    width: 100%;
    max-width: 1180px;
  }

  @media (max-width: 768px) {
    .family-stage {
      min-height: 0;
      padding: 20px 16px;
    }

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
