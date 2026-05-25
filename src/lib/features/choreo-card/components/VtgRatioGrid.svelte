<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { VTG_RATIO_LEVEL_MAP } from "../domain/elemental-theme";
  import VtgRatioCard from "./VtgRatioCard.svelte";

  interface Props {
    catalogs: Catalog[];
    onSelectCatalog: (catalogId: string) => void;
  }

  const { catalogs, onSelectCatalog }: Props = $props();

  function getRatio(catalog: Catalog): string {
    return catalog.name.match(/\((\d+:\d+)/)?.[1] ?? "1:1";
  }

  function groupByLevel(all: Catalog[]): { level: number; catalogs: Catalog[] }[] {
    const groups = new Map<number, Catalog[]>();
    for (const catalog of all) {
      const ratio = getRatio(catalog);
      const level = VTG_RATIO_LEVEL_MAP[ratio] ?? catalog.level;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level)!.push(catalog);
    }

    const ratioOrder = ["1:1", "3:1", "5:1", "7:1", "2:1", "4:1", "6:1"];
    for (const [, group] of groups) {
      group.sort(
        (a, b) =>
          ratioOrder.indexOf(getRatio(a)) -
          ratioOrder.indexOf(getRatio(b)),
      );
    }

    return [1, 2, 3]
      .filter((level) => groups.has(level))
      .map((level) => ({ level, catalogs: groups.get(level)! }));
  }

  const levelGroups = $derived(groupByLevel(catalogs));
</script>

<div class="ratio-layout">
  {#each levelGroups as group (group.level)}
    <div class="ratio-row">
      {#each group.catalogs as catalog (catalog.id)}
        <VtgRatioCard {catalog} onSelect={() => onSelectCatalog(catalog.id)} />
      {/each}
    </div>
  {/each}
</div>

<style>
  .ratio-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 960px;
    margin: 0 auto;
  }

  .ratio-row {
    display: flex;
    gap: 20px;
    justify-content: center;
  }

  .ratio-row > :global(*) {
    flex: 0 0 calc(33.333% - 14px);
    max-width: calc(33.333% - 14px);
  }

  @media (max-width: 768px) {
    .ratio-row {
      flex-wrap: wrap;
    }

    .ratio-row > :global(*) {
      flex: 0 0 calc(50% - 10px);
      max-width: calc(50% - 10px);
    }
  }

  @media (max-width: 480px) {
    .ratio-row > :global(*) {
      flex: 0 0 100%;
      max-width: 100%;
    }
  }
</style>
