<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import {
    REVERSAL_PATTERNS,
    REVERSAL_FAMILIES,
    type ReversalPatternDef,
  } from "../domain/reversal-patterns";
  import ReversalPatternCard from "./ReversalPatternCard.svelte";

  interface Props {
    catalogs: Catalog[];
    onSelectPattern: (patternId: string) => void;
  }

  const { catalogs, onSelectPattern }: Props = $props();

  const patternGroups = $derived(
    REVERSAL_PATTERNS
      .map(pattern => {
        const matching = catalogs.filter(d =>
          (d.reversalPattern || 'continuous') === pattern.id
        );
        const sequenceCount = matching.reduce((sum, d) => sum + d.totalSequences, 0);
        return { pattern, sequenceCount };
      })
      .filter(g => g.sequenceCount > 0)
  );

  // Group the populated patterns by family in REVERSAL_FAMILIES order
  const familySections = $derived(
    REVERSAL_FAMILIES
      .map(family => ({
        family,
        label: family.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        groups: patternGroups.filter(g => g.pattern.family === family),
      }))
      .filter(section => section.groups.length > 0)
  );
</script>

<div class="reversal-grid-layout">
  <h3 class="section-header">BY REVERSAL</h3>

  {#each familySections as section (section.family)}
    <div class="family-section">
      <h4 class="family-label">{section.label}</h4>
      <div class="pattern-grid">
        {#each section.groups as group (group.pattern.id)}
          <ReversalPatternCard
            pattern={group.pattern}
            sequenceCount={group.sequenceCount}
            onclick={() => onSelectPattern(group.pattern.id)}
          />
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .reversal-grid-layout {
    width: 100%;
  }

  .section-header {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    text-align: center;
    text-transform: uppercase;
    font-weight: 600;
    margin: 0 0 20px;
  }

  .family-section {
    margin-bottom: 28px;
  }

  .family-section:last-child {
    margin-bottom: 0;
  }

  .family-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
    margin: 0 0 12px;
    text-align: center;
  }

  .pattern-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 960px;
    margin: 0 auto;
  }

  @media (max-width: 700px) {
    .pattern-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .pattern-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
