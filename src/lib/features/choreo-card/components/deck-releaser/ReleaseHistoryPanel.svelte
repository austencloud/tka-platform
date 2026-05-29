<script lang="ts">
  import type { DeckRelease } from "../../domain/models/DeckRelease";

  interface Props {
    releases: DeckRelease[];
    isLoading: boolean;
    activeDeckNumber: number | null;
    onSelectRelease: (release: DeckRelease) => void;
  }

  const { releases, isLoading, activeDeckNumber, onSelectRelease }: Props = $props();

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function distributionSummary(dist: Record<number, number>): string {
    return Object.entries(dist)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([step, count]) => `${step}s:${count}`)
      .join("  ");
  }

  function displayName(r: DeckRelease): string {
    return r.name?.trim() || r.notes?.trim() || `Deck #${String(r.deckNumber).padStart(3, "0")}`;
  }
</script>

<div class="release-history">
  <h3 class="panel-title">
    <i class="fas fa-archive" aria-hidden="true"></i>
    Released Decks
    {#if releases.length > 0}
      <span class="release-count">{releases.length}</span>
    {/if}
  </h3>

  {#if isLoading}
    <div class="panel-empty">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading releases...</span>
    </div>
  {:else if releases.length === 0}
    <div class="panel-empty">
      <i class="fas fa-box-open" aria-hidden="true"></i>
      <span>No decks released yet</span>
    </div>
  {:else}
    <div class="release-list">
      {#each releases as release (release.deckNumber)}
        <button
          type="button"
          class="release-item"
          class:active={activeDeckNumber === release.deckNumber}
          onclick={() => onSelectRelease(release)}
          aria-label="View Deck {release.deckNumber}: {displayName(release)}"
          aria-pressed={activeDeckNumber === release.deckNumber}
        >
          <div class="release-header">
            <span class="deck-badge">#{String(release.deckNumber).padStart(3, "0")}</span>
            <span class="release-date">{formatDate(release.createdAt)}</span>
          </div>
          <div class="release-notes">{displayName(release)}</div>
          <div class="release-meta">
            <span class="card-count">{release.cardCount} cards</span>
            <span class="distribution">{distributionSummary(release.stepCountDistribution)}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .release-history {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 16px 20px;
    font-size: 14px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .panel-title i {
    color: var(--theme-accent, #8b5cf6);
    font-size: 13px;
  }

  .release-count {
    margin-left: auto;
    padding: 1px 8px;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-accent, #a78bfa);
  }

  .panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 48px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 13px;
  }

  .panel-empty i {
    font-size: 24px;
  }

  .release-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .release-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: inherit;
    font: inherit;
    transition: border-color 0.15s ease;
  }

  .release-item:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .release-item.active {
    border-color: var(--theme-accent, rgba(139, 92, 246, 0.5));
    background: rgba(139, 92, 246, 0.08);
  }

  .release-item:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .release-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .deck-badge {
    font-size: 14px;
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
    font-variant-numeric: tabular-nums;
  }

  .release-date {
    margin-left: auto;
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
  }

  .release-notes {
    font-size: 13px;
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    line-height: 1.3;
  }

  .release-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .card-count {
    font-weight: 600;
  }

  .distribution {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  @media (prefers-reduced-motion: reduce) {
    .release-item {
      transition: none;
    }
  }
</style>
