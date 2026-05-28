<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { SIMPLE_PATTERNS } from "../domain/reversal-patterns";
  import ReversalPatternCard from "./ReversalPatternCard.svelte";

  interface Props {
    catalogs: Catalog[];
    onSelectPattern: (patternId: string) => void;
  }

  const { catalogs, onSelectPattern }: Props = $props();

  const patternGroups = $derived(
    SIMPLE_PATTERNS.map((pattern) => {
      const matching = catalogs.filter(
        (d) => (d.reversalPattern || "continuous") === pattern.id,
      );
      const sequenceCount = matching.reduce(
        (sum, d) => sum + d.totalSequences,
        0,
      );
      return { pattern, sequenceCount };
    }).filter((g) => g.sequenceCount > 0),
  );
</script>

<div class="reversal-layout">
  <h3 class="section-header">BY REVERSAL</h3>

  <div class="reversal-grid">
    {#each patternGroups as group (group.pattern.id)}
      <ReversalPatternCard
        pattern={group.pattern}
        sequenceCount={group.sequenceCount}
        onclick={() => onSelectPattern(group.pattern.id)}
      />
    {/each}
  </div>
</div>

<style>
  .reversal-layout {
    width: 100%;
  }

  .section-header {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    text-align: center;
    text-transform: uppercase;
    font-weight: 600;
    margin: 0 0 16px;
  }

  .reversal-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 960px;
    margin: 0 auto;
  }

  @media (max-width: 700px) {
    .reversal-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
