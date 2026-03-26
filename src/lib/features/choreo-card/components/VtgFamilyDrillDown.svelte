<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { FamilyRatioGroup } from "../services/contracts/IVtgFamilyAggregator";
  import type { IVtgFamilyAggregator } from "../services/contracts/IVtgFamilyAggregator";
  import { VTG_ELEMENTAL_THEMES } from "../domain/elemental-theme";
  import { container } from "$lib/shared/di";
  import ChoreoCard from "./ChoreoCard.svelte";

  interface Props {
    familyId: string;
    decks: Deck[];
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onSelectSequence: (sequence: SequenceData) => void;
    onBack: () => void;
  }

  const {
    familyId,
    decks,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onSelectSequence,
    onBack,
  }: Props = $props();

  const theme = $derived(
    VTG_ELEMENTAL_THEMES.find((t) => t.familyId === familyId),
  );
  const familyLabel = $derived(
    theme
      ? `${theme.familyId.split("-").map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1)).join("-")} (${theme.element[0]?.toUpperCase()}${theme.element.slice(1)})`
      : familyId,
  );

  let ratioGroups = $state<FamilyRatioGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    const aggregator = container.items
      .vtgFamilyAggregator as IVtgFamilyAggregator;
    aggregator
      .aggregateFamilySequences(familyId, decks)
      .then((groups) => {
        ratioGroups = groups;
        loading = false;
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : String(err);
        loading = false;
      });
  });

  function turnsLabel(turns: number): string {
    if (turns === 0) return "0 turns";
    if (turns === 1) return "1 turn";
    return `${turns} turns`;
  }
</script>

<div class="vtg-family-drilldown">
  <div class="top-bar">
    <nav class="breadcrumb" aria-label="Deck navigation">
      <button class="crumb" onclick={onBack} type="button">VTG</button>
      <span class="crumb-sep" aria-hidden="true">›</span>
      <span class="crumb current">{familyLabel}</span>
    </nav>
  </div>

  {#if loading}
    <div class="loading" role="status" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading sequences...
    </div>
  {:else if error}
    <div class="error-state" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <p>{error}</p>
      <button type="button" class="back-btn" onclick={onBack}>Back to VTG</button>
    </div>
  {:else if ratioGroups.length === 0}
    <div class="empty-state" role="status">
      <p>No sequences found for {familyLabel}</p>
      <button type="button" class="back-btn" onclick={onBack}>Back to VTG</button>
    </div>
  {:else}
    {#each ratioGroups as group (group.ratio)}
      <section class="ratio-section">
        <h3 class="ratio-header" style="--accent: {theme?.accentColor ?? '#fff'};">
          {group.ratio}
          <span class="turns-note">{turnsLabel(group.turns)}</span>
        </h3>
        <div class="sequence-grid">
          {#each group.sequences as sequence (sequence.id ?? sequence.word)}
            <ChoreoCard
              {sequence}
              {handPointsVisible}
              {showGrid}
              {showTKA}
              {showWord}
              {includeStartPosition}
              onSelect={() => onSelectSequence(sequence)}
            />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .vtg-family-drilldown {
    width: 100%;
  }

  .top-bar {
    padding: 0 0 16px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
  }

  .crumb {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    padding: 0;
    font-size: inherit;
  }

  .crumb:hover {
    color: var(--theme-text, #fff);
  }

  .crumb-sep {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .crumb.current {
    color: var(--theme-text, #fff);
    font-weight: 600;
  }

  .loading,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .back-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    padding: 8px 16px;
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
  }

  .ratio-section {
    margin-bottom: 24px;
  }

  .ratio-header {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--accent, #fff);
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .turns-note {
    font-weight: 400;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: 8px;
    font-size: var(--font-size-compact, 12px);
  }

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  @media (max-width: 480px) {
    .sequence-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
    }
  }
</style>
