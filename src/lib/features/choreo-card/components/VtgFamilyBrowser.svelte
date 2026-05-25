<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { VTG_FAMILY_KEYS, VTG_FAMILY_LABELS } from "../state/catalog-browse-types";
  import { parseTurnPattern } from "../domain/turn-pattern-parser";
  import CatalogCard from "./CatalogCard.svelte";

  interface FamilyInfo {
    id: string;
    name: string;
    iconPath: string;
    sequenceCount: number;
  }

  interface Props {
    catalogs: Catalog[];
    onSelectCatalog: (catalog: Catalog) => void;
  }

  const { catalogs, onSelectCatalog }: Props = $props();

  const FAMILY_META: Record<string, { name: string; iconPath: string }> = {
    "split-same":   { name: "Split-Same",   iconPath: "/images/elements/water-v2.png" },
    "tog-same":     { name: "Tog-Same",     iconPath: "/images/elements/earth-v2.png" },
    "quarter-same": { name: "Quarter-Same", iconPath: "/images/elements/sun-v2.png" },
    "split-opp":    { name: "Split-Opp",    iconPath: "/images/elements/fire-v2.png" },
    "tog-opp":      { name: "Tog-Opp",      iconPath: "/images/elements/air-v2.png" },
    "quarter-opp":  { name: "Quarter-Opp",  iconPath: "/images/elements/moon-v2.png" },
  };

  let selectedFamily = $state<string | null>(null);

  const familyInfos = $derived.by((): FamilyInfo[] => {
    const counts = new Map<string, number>();
    for (const catalog of catalogs) {
      for (const fam of catalog.families) {
        for (const key of VTG_FAMILY_KEYS) {
          if (fam.id.toLowerCase().includes(key)) {
            counts.set(key, (counts.get(key) ?? 0) + fam.sequenceIds.length);
            break;
          }
        }
      }
    }

    return VTG_FAMILY_KEYS
      .filter(k => counts.has(k))
      .map(k => ({
        id: k,
        name: FAMILY_META[k]?.name ?? k,
        iconPath: FAMILY_META[k]?.iconPath ?? "",
        sequenceCount: counts.get(k) ?? 0,
      }));
  });

  function formatTurnLabel(catalog: Catalog): string {
    const coord = parseTurnPattern(catalog.turnPattern);
    if (!coord) return catalog.turnPattern;
    return coord.blue === coord.red ? `${coord.blue}T` : `${coord.blue}|${coord.red}`;
  }

  const familyCatalogs = $derived.by(() => {
    if (!selectedFamily) return [];
    return catalogs
      .filter(c => c.families.some(f => f.id.toLowerCase().includes(selectedFamily!)))
      .sort((a, b) => {
        const ca = parseTurnPattern(a.turnPattern);
        const cb = parseTurnPattern(b.turnPattern);
        if (!ca || !cb) return 0;
        return ca.blue - cb.blue || ca.red - cb.red;
      });
  });
</script>

<div class="family-browser">
  {#if !selectedFamily}
    <div class="family-picker">
      {#each familyInfos as info (info.id)}
        <button
          type="button"
          class="family-button"
          aria-label="{info.name} — {info.sequenceCount} sequences"
          onclick={() => { selectedFamily = info.id; }}
        >
          {#if info.iconPath}
            <img src={info.iconPath} alt="" class="family-icon" aria-hidden="true" />
          {/if}
          <span class="family-name">{info.name}</span>
          <span class="family-count">{info.sequenceCount}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="family-sequences">
      <div class="family-header">
        <button
          type="button"
          class="back-btn"
          aria-label="Back to family picker"
          onclick={() => { selectedFamily = null; }}
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
        <span class="family-title">
          {VTG_FAMILY_LABELS[selectedFamily] ?? selectedFamily}
        </span>
        <span class="family-seq-count">{familyCatalogs.length} catalogs</span>
      </div>

      <div class="catalog-grid">
        {#each familyCatalogs as catalog (catalog.id)}
          <CatalogCard
            {catalog}
            tags={formatTurnLabel(catalog)}
            onSelect={() => onSelectCatalog(catalog)}
          />
        {/each}
      </div>

      {#if familyCatalogs.length === 0}
        <div class="empty-state">
          <p>No catalogs found for this family.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .family-browser {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .family-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .family-button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .family-button:hover {
    border-color: rgba(183, 99, 205, 0.4);
    background: rgba(183, 99, 205, 0.08);
  }

  .family-button:focus-visible {
    outline: 2px solid rgba(183, 99, 205, 0.6);
    outline-offset: 2px;
  }

  .family-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .family-name { flex: 1; text-align: left; }

  .family-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-weight: 400;
  }

  .family-sequences {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .family-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .back-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .family-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .family-seq-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }

  .empty-state {
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .family-browser { padding: 16px; }
    .family-picker { grid-template-columns: repeat(2, 1fr); }
    .catalog-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .family-button, .back-btn { transition: none; }
  }
</style>
